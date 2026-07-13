import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Transaction from "@/lib/models/Transaction";

describe("Transaction model", () => {
  beforeAll(async () => {
    await startTestDb();
    await connectDB();
    await Transaction.init();
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  const userId = new mongoose.Types.ObjectId();
  const accountId = new mongoose.Types.ObjectId();
  const categoryId = new mongoose.Types.ObjectId();

  it("creates a transaction with valid data", async () => {
    const tx = await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "expense",
      amount: 25000,
      currency: "COP",
      date: new Date("2026-02-01"),
    });

    expect(tx.type).toBe("expense");
    expect(tx.amount).toBe(25000);
    expect(tx.currency).toBe("COP");
    expect(tx.createdAt).toBeInstanceOf(Date);
  });

  it("rejects a transaction missing required fields", async () => {
    await expect(
      Transaction.create({ userId, accountId } as never)
    ).rejects.toThrow();
  });

  it("rejects an invalid type", async () => {
    await expect(
      Transaction.create({
        userId,
        accountId,
        categoryId,
        type: "invalid",
        amount: 100,
        currency: "COP",
        date: new Date(),
      } as never)
    ).rejects.toThrow();
  });

  it("rejects a non-positive amount", async () => {
    await expect(
      Transaction.create({
        userId,
        accountId,
        categoryId,
        type: "expense",
        amount: 0,
        currency: "COP",
        date: new Date(),
      })
    ).rejects.toThrow();
  });

  it("allows an optional description", async () => {
    const tx = await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "income",
      amount: 50000,
      currency: "COP",
      date: new Date(),
      description: "Pago freelance",
    });
    expect(tx.description).toBe("Pago freelance");
  });

  it("does not change currency on a later save (schema-level immutability)", async () => {
    const tx = await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "expense",
      amount: 1000,
      currency: "COP",
      date: new Date(),
    });

    tx.currency = "USD";
    await tx.save();

    const reloaded = await Transaction.findById(tx._id);
    expect(reloaded?.currency).toBe("COP");
  });

  it("has the four documented compound indexes", async () => {
    const indexes = await Transaction.collection.indexes();
    const indexKeys = indexes.map((index) => Object.keys(index.key).join(","));

    expect(indexKeys).toContain("userId,date");
    expect(indexKeys).toContain("userId,accountId,date");
    expect(indexKeys).toContain("userId,categoryId,date");
    expect(indexKeys).toContain("userId,type,date");
  });

  it("findForUser returns only that user's transactions", async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "expense",
      amount: 100,
      currency: "COP",
      date: new Date(),
    });
    await Transaction.create({
      userId: otherUserId,
      accountId,
      categoryId,
      type: "expense",
      amount: 200,
      currency: "COP",
      date: new Date(),
    });

    const results = await Transaction.findForUser(userId);
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(100);
  });

  it("findForUser applies an additional filter", async () => {
    await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "income",
      amount: 1000,
      currency: "COP",
      date: new Date(),
    });
    await Transaction.create({
      userId,
      accountId,
      categoryId,
      type: "expense",
      amount: 500,
      currency: "COP",
      date: new Date(),
    });

    const results = await Transaction.findForUser(userId, { type: "income" });
    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(1000);
  });
});
