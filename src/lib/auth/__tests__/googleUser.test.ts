import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import Category from "@/lib/models/Category";
import { findOrCreateGoogleUser } from "@/lib/auth/googleUser";

describe("findOrCreateGoogleUser", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
  });

  afterEach(async () => {
    await clearTestDb();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const profile = {
    googleId: "google-sub-123",
    email: "ana@example.com",
    name: "Ana",
    emailVerified: true,
  };

  // FR-017 — the rule the whole linking policy rests on. Without it, anyone who
  // registers this address with Google without proving it takes over the account.
  it("refuses a profile whose email Google has not verified, creating nothing", async () => {
    const result = await findOrCreateGoogleUser({
      ...profile,
      emailVerified: false,
    });

    expect(result).toBeNull();
    expect(await User.countDocuments()).toBe(0);
  });

  it("does not link an unverified profile to an existing account", async () => {
    await User.create({
      email: "ana@example.com",
      name: "Ana",
      passwordHash: "hashed",
    });

    const result = await findOrCreateGoogleUser({
      ...profile,
      emailVerified: false,
    });

    expect(result).toBeNull();
    const user = await User.findOne({ email: "ana@example.com" });
    expect(user?.googleId).toBeUndefined();
  });

  // FR-015 — a Google sign-in never touches /api/auth/signup, where the seed
  // used to live. Without this the user lands with zero categories and cannot
  // record a single expense.
  it("creates a new user and seeds the 21 default categories", async () => {
    const result = await findOrCreateGoogleUser(profile);

    expect(result).not.toBeNull();
    const user = await User.findById(result!.id);
    expect(user?.email).toBe("ana@example.com");
    expect(user?.googleId).toBe("google-sub-123");
    expect(await Category.countDocuments({ userId: user!._id })).toBe(21);
  });

  it("a Google-created user has no password at all", async () => {
    const result = await findOrCreateGoogleUser(profile);

    const user = await User.findById(result!.id).select("+passwordHash");
    expect(user?.passwordHash).toBeUndefined();
  });

  // FR-016 — the owner already has a password account. Signing in with the same
  // Google address must land on it, with its data, not on a fresh empty one.
  it("links to an existing password account by verified email, keeping its data", async () => {
    const existing = await User.create({
      email: "ana@example.com",
      name: "Ana",
      passwordHash: "hashed",
    });
    await Category.create({ userId: existing._id, name: "Mía", type: "expense" });

    const result = await findOrCreateGoogleUser(profile);

    expect(result!.id).toBe(existing._id.toString());
    expect(await User.countDocuments()).toBe(1);

    const linked = await User.findById(existing._id).select("+passwordHash");
    expect(linked?.googleId).toBe("google-sub-123");
    // The password still works — linking adds a way in, it doesn't remove one.
    expect(linked?.passwordHash).toBe("hashed");
    // And it did NOT reseed on top of the categories they already had.
    expect(await Category.countDocuments({ userId: existing._id })).toBe(1);
  });

  it("finds an already-linked user without duplicating or reseeding", async () => {
    const first = await findOrCreateGoogleUser(profile);
    const second = await findOrCreateGoogleUser(profile);

    expect(second!.id).toBe(first!.id);
    expect(await User.countDocuments()).toBe(1);
    expect(await Category.countDocuments()).toBe(21);
  });

  // googleId is matched first precisely so this works.
  it("matches by googleId even when the Google email changed", async () => {
    const first = await findOrCreateGoogleUser(profile);

    const second = await findOrCreateGoogleUser({
      ...profile,
      email: "ana.nueva@example.com",
    });

    expect(second!.id).toBe(first!.id);
    expect(await User.countDocuments()).toBe(1);
  });

  // Same compensating delete as the signup route: never a user with zero
  // categories, since no Mongo transaction ties the two writes together.
  it("deletes the half-created user if seeding the categories fails", async () => {
    const seed = await import("@/lib/seed/defaultCategories");
    vi.spyOn(seed, "seedDefaultCategories").mockRejectedValueOnce(
      new Error("mongo caído")
    );

    await expect(findOrCreateGoogleUser(profile)).rejects.toThrow();

    expect(await User.countDocuments()).toBe(0);
    expect(await Category.countDocuments()).toBe(0);
  });
});
