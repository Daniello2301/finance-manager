import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";

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
});
