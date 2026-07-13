import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";

describe("User model", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
    await User.init();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  it("creates a user with valid data and timestamps", async () => {
    const user = await User.create({
      email: "Ana@Example.com",
      name: "Ana Pérez",
      passwordHash: "hashed-value",
    });

    expect(user.email).toBe("ana@example.com");
    expect(user.name).toBe("Ana Pérez");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("trims whitespace from the email", async () => {
    const user = await User.create({
      email: "  trim@example.com  ",
      name: "Trim Test",
      passwordHash: "hash",
    });

    expect(user.email).toBe("trim@example.com");
  });

  it("rejects a user missing required fields", async () => {
    await expect(
      User.create({ email: "missing@example.com" } as never)
    ).rejects.toThrow();
  });

  it("enforces a unique email", async () => {
    await User.create({
      email: "dup@example.com",
      name: "Dup One",
      passwordHash: "hash1",
    });

    await expect(
      User.create({
        email: "dup@example.com",
        name: "Dup Two",
        passwordHash: "hash2",
      })
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("excludes passwordHash from default query results", async () => {
    await User.create({
      email: "secret@example.com",
      name: "Secret",
      passwordHash: "super-secret-hash",
    });

    const found = await User.findOne({ email: "secret@example.com" });
    expect(found?.passwordHash).toBeUndefined();
  });

  it("includes passwordHash when explicitly selected", async () => {
    await User.create({
      email: "select@example.com",
      name: "Select",
      passwordHash: "super-secret-hash",
    });

    const found = await User.findOne({ email: "select@example.com" }).select(
      "+passwordHash"
    );
    expect(found?.passwordHash).toBe("super-secret-hash");
  });
});
