import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  startTestReplSet,
  stopTestReplSet,
} from "@/lib/test-utils/mongoMemoryReplSet";
import { clearTestDb } from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { InsufficientFundsError } from "@/lib/errors";
import {
  createTransaction,
  updateTransaction,
} from "@/lib/services/transactions";

/**
 * The insufficient-funds guard is a warning, not a rule: the caller can override
 * it with `confirmOverdraft`. What must hold either way is that a *rejected*
 * attempt leaves nothing behind — the guard throws from inside
 * `session.withTransaction`, so the balance `$inc` it just applied has to be
 * rolled back with it. These tests exist mostly to prove that rollback.
 */
describe("transactions service — insufficient funds", () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestReplSet();
    await connectDB();
  }, 60000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestReplSet();
  }, 30000);

  async function seedCategory() {
    const category = await Category.create({
      userId,
      name: "Mercado",
      type: "expense",
    });
    return category._id.toString();
  }

  async function seedCash(balance: number) {
    const account = await Account.create({
      userId,
      name: "Efectivo",
      type: "cash",
      currency: "COP",
      initialBalance: balance,
      currentBalance: balance,
    });
    return account._id.toString();
  }

  it("rejects an expense above the balance and leaves the balance untouched", async () => {
    const accountId = await seedCash(50000);
    const categoryId = await seedCategory();

    await expect(
      createTransaction(userId, {
        accountId,
        categoryId,
        type: "expense",
        amount: 80000,
        date: new Date("2026-07-13"),
      })
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    // The $inc ran before the guard threw — this asserts withTransaction undid it.
    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(50000);

    expect(await Transaction.countDocuments()).toBe(0);
  });

  it("reports the balance as it was *before* the attempt", async () => {
    const accountId = await seedCash(50000);
    const categoryId = await seedCategory();

    try {
      await createTransaction(userId, {
        accountId,
        categoryId,
        type: "expense",
        amount: 80000,
        date: new Date("2026-07-13"),
      });
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InsufficientFundsError);
      // Not -30000 (the post-$inc figure) — the user needs to be told what they
      // actually have, not what they would have been left with.
      expect((error as InsufficientFundsError).available).toBe(50000);
      expect((error as InsufficientFundsError).currency).toBe("COP");
    }
  });

  it("goes through, and lets the balance go negative, when confirmOverdraft is set", async () => {
    const accountId = await seedCash(50000);
    const categoryId = await seedCategory();

    await createTransaction(userId, {
      accountId,
      categoryId,
      type: "expense",
      amount: 80000,
      date: new Date("2026-07-13"),
      confirmOverdraft: true,
    });

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-30000);
  });

  it("measures a credit card against its credit limit, not against zero", async () => {
    const card = await Account.create({
      userId,
      name: "Visa",
      type: "credit_card",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
      creditLimit: 1000000,
    });
    const categoryId = await seedCategory();

    // A card at a zero balance still has a million of credit — this must NOT be
    // treated as "no funds", which a naive `currentBalance < 0` check would.
    const tx = await createTransaction(userId, {
      accountId: card._id.toString(),
      categoryId,
      type: "expense",
      amount: 900000,
      date: new Date("2026-07-13"),
    });
    expect(tx).toBeTruthy();

    const afterFirst = await Account.findById(card._id);
    expect(afterFirst?.currentBalance).toBe(-900000);

    // Now only 100k of credit is left, so 200k must be refused.
    await expect(
      createTransaction(userId, {
        accountId: card._id.toString(),
        categoryId,
        type: "expense",
        amount: 200000,
        date: new Date("2026-07-13"),
      })
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    const afterSecond = await Account.findById(card._id);
    expect(afterSecond?.currentBalance).toBe(-900000);
  });

  it("never blocks income, even on an account already in the red", async () => {
    const accountId = await seedCash(-50000);
    const category = await Category.create({
      userId,
      name: "Salario",
      type: "income",
    });

    await createTransaction(userId, {
      accountId,
      categoryId: category._id.toString(),
      type: "income",
      amount: 10000,
      date: new Date("2026-07-13"),
    });

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-40000);
  });

  it("rejects an edit that raises the amount past the balance, and reverts cleanly", async () => {
    const accountId = await seedCash(100000);
    const categoryId = await seedCategory();

    const tx = await createTransaction(userId, {
      accountId,
      categoryId,
      type: "expense",
      amount: 30000,
      date: new Date("2026-07-13"),
    });
    expect((await Account.findById(accountId))?.currentBalance).toBe(70000);

    await expect(
      updateTransaction(userId, tx._id.toString(), { amount: 250000 })
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    // updateTransaction reverts the old delta and applies the new one; a failure
    // partway through must not leave the revert applied on its own.
    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(70000);

    const reloaded = await Transaction.findById(tx._id);
    expect(reloaded?.amount).toBe(30000);
  });

  it("allows an edit below the balance without any confirmation", async () => {
    const accountId = await seedCash(100000);
    const categoryId = await seedCategory();

    const tx = await createTransaction(userId, {
      accountId,
      categoryId,
      type: "expense",
      amount: 30000,
      date: new Date("2026-07-13"),
    });

    await updateTransaction(userId, tx._id.toString(), { amount: 40000 });

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(60000);
  });
});
