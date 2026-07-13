import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB, redactMongoUri } from "@/lib/db";

describe("redactMongoUri", () => {
  it("strips credentials from a standard connection string", () => {
    expect(redactMongoUri("failed: mongodb://user:pass@host/db")).toBe(
      "failed: mongodb://***:***@host/db"
    );
  });

  it("strips credentials from an SRV connection string", () => {
    expect(
      redactMongoUri(
        "querySrv ENOTFOUND mongodb+srv://dbUser:s3cr3t@cluster0.mongodb.net/finance"
      )
    ).toBe(
      "querySrv ENOTFOUND mongodb+srv://***:***@cluster0.mongodb.net/finance"
    );
  });

  it("leaves a message with no connection string unchanged", () => {
    expect(redactMongoUri("connect ECONNREFUSED 127.0.0.1:1")).toBe(
      "connect ECONNREFUSED 127.0.0.1:1"
    );
  });
});

describe("connectDB", () => {
  beforeAll(async () => {
    await startTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it("connects successfully to MongoDB", async () => {
    const conn = await connectDB();
    expect(conn.connection.readyState).toBe(1);
  });

  it("reuses the cached connection on subsequent calls", async () => {
    const first = await connectDB();
    const second = await connectDB();
    expect(second).toBe(first);
  });

  it("throws a clear error when MONGODB_URI is missing", async () => {
    const originalUri = process.env.MONGODB_URI;
    delete process.env.MONGODB_URI;
    delete (globalThis as unknown as { __mongooseConn?: unknown })
      .__mongooseConn;

    vi.resetModules();
    const fresh = await import("@/lib/db");
    await expect(fresh.connectDB()).rejects.toThrow(/MONGODB_URI/);

    process.env.MONGODB_URI = originalUri;
  });

  it("clears the cached promise on a failed connection so a later call can retry", async () => {
    const workingUri = process.env.MONGODB_URI;
    delete (globalThis as unknown as { __mongooseConn?: unknown })
      .__mongooseConn;

    // Nothing listens on this port — fails fast (ECONNREFUSED) rather than
    // hanging for the full serverSelectionTimeoutMS.
    process.env.MONGODB_URI = "mongodb://127.0.0.1:1/unreachable";
    vi.resetModules();
    const fresh = await import("@/lib/db");

    await expect(fresh.connectDB()).rejects.toThrow();

    // Without clearing the cached rejected promise, this second call would
    // instantly re-throw the same stale error instead of retrying — even
    // though MONGODB_URI now points at a reachable database.
    process.env.MONGODB_URI = workingUri;
    const conn = await fresh.connectDB();
    expect(conn.connection.readyState).toBe(1);
  }, 15000);

  it("reconnects when the cached connection has dropped after a prior success", async () => {
    const first = await connectDB();
    expect(first.connection.readyState).toBe(1);

    await first.connection.close();
    expect(first.connection.readyState).not.toBe(1);

    const second = await connectDB();
    expect(second.connection.readyState).toBe(1);
  }, 15000);
});
