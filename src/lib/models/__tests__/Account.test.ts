import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";

describe("Account model", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
    await Account.init();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const userId = new mongoose.Types.ObjectId();

  it("creates an account with valid data", async () => {
    const account = await Account.create({
      userId,
      name: "Bancolombia Ahorros",
      type: "bank",
      initialBalance: 500000,
      currentBalance: 500000,
    });

    expect(account.name).toBe("Bancolombia Ahorros");
    expect(account.type).toBe("bank");
    expect(account.currency).toBe("COP");
    expect(account.isArchived).toBe(false);
    expect(account.createdAt).toBeInstanceOf(Date);
  });

  it("rejects an account missing required fields", async () => {
    await expect(
      Account.create({ userId, type: "bank" } as never)
    ).rejects.toThrow();
  });

  it("rejects an invalid type", async () => {
    await expect(
      Account.create({
        userId,
        name: "X",
        type: "invalid",
        initialBalance: 0,
        currentBalance: 0,
      } as never)
    ).rejects.toThrow();
  });

  it("defaults currency to COP", async () => {
    const account = await Account.create({
      userId,
      name: "Efectivo",
      type: "cash",
      initialBalance: 0,
      currentBalance: 0,
    });
    expect(account.currency).toBe("COP");
  });

  it("does not change currency on a later save (schema-level immutability)", async () => {
    const account = await Account.create({
      userId,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });

    account.currency = "USD";
    await account.save();

    const reloaded = await Account.findById(account._id);
    expect(reloaded?.currency).toBe("COP");
  });

  it("findForUser returns only that user's accounts", async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await Account.create({
      userId,
      name: "Mine",
      type: "cash",
      initialBalance: 0,
      currentBalance: 0,
    });
    await Account.create({
      userId: otherUserId,
      name: "Theirs",
      type: "cash",
      initialBalance: 0,
      currentBalance: 0,
    });

    const results = await Account.findForUser(userId);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Mine");
  });

  it("findForUser applies an additional filter", async () => {
    await Account.create({
      userId,
      name: "Active",
      type: "cash",
      initialBalance: 0,
      currentBalance: 0,
      isArchived: false,
    });
    await Account.create({
      userId,
      name: "Archived",
      type: "cash",
      initialBalance: 0,
      currentBalance: 0,
      isArchived: true,
    });

    const results = await Account.findForUser(userId, { isArchived: false });
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Active");
  });
});
