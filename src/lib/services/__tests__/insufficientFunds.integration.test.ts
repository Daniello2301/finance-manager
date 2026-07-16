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
  deleteTransaction,
  updateTransaction,
} from "@/lib/services/transactions";

/**
 * The insufficient-funds guard is a RULE, not a warning (ratified 2026-07-14):
 * `confirmOverdraft` is gone and an expense past the available balance simply
 * cannot be created. Two things must hold, and these tests exist to prove both:
 *
 * 1. A rejected attempt leaves NOTHING behind. The guard throws from inside
 *    `session.withTransaction`, so the balance `$inc` it just applied is rolled
 *    back with it.
 * 2. The rule stops at creation. Editing or deleting a transaction is correcting
 *    the record of money that already moved, and IS allowed to overdraw the
 *    account — otherwise the user is locked inside their own mistake.
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

  // There used to be a `confirmOverdraft` escape hatch here. It was removed
  // (ratified 2026-07-14): money does not appear out of nowhere. Creating is a
  // decision, and the decision is now simply refused — the caller has to say
  // where the money came from instead (a loan, another account, an unrecorded
  // income, or a balance adjustment).
  it("cannot be forced through: the balance is left untouched", async () => {
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

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(50000);
    expect(await Transaction.countDocuments({ userId })).toBe(0);
  });

  // The automatic recurring generator records a charge the bank has ALREADY
  // made: a consummated fact, not a decision. It passes `allowOverdraft`, and a
  // fact that overdraws is written down, leaving the account in the red (ratified
  // 2026-07-15). This is NOT the old `confirmOverdraft` escape — the flag is a
  // service argument no HTTP route exposes, so a user can't force a decision.
  it("records an overdrawing charge when the caller says it is a consummated fact", async () => {
    const accountId = await seedCash(100000);
    const categoryId = await seedCategory();

    const tx = await createTransaction(
      userId,
      {
        accountId,
        categoryId,
        type: "expense",
        amount: 300000,
        date: new Date("2026-07-13"),
      },
      { allowOverdraft: true }
    );
    expect(tx).toBeTruthy();

    // Written down, and the account is left overdrawn on purpose.
    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-200000);
    expect(await Transaction.countDocuments({ userId })).toBe(1);
  });

  // The other side of the same rule. A transaction that already exists is money
  // that already moved: correcting it is fixing the record of a fact, not
  // deciding to spend. Blocking it would lock the user inside their own typo —
  // record 100.000 for what was really 250.000, then be refused the correction.
  it("lets an EDIT overdraw the account, because editing is correcting the past", async () => {
    const accountId = await seedCash(50000);
    const categoryId = await seedCategory();

    const tx = await createTransaction(userId, {
      accountId,
      categoryId,
      type: "expense",
      amount: 30000,
      date: new Date("2026-07-13"),
    });

    await updateTransaction(userId, tx.id, { amount: 200000 });

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-150000);
  });

  it("lets a DELETE overdraw the account, for the same reason", async () => {
    const accountId = await seedCash(0);
    const categoryId = await seedCategory();
    const incomeCategory = await Category.create({
      userId,
      name: "Salario",
      type: "income",
    });

    // A salary that never happened, and the spending that followed it.
    const badIncome = await createTransaction(userId, {
      accountId,
      categoryId: incomeCategory.id,
      type: "income",
      amount: 3_000_000,
      date: new Date("2026-07-01"),
    });
    await createTransaction(userId, {
      accountId,
      categoryId,
      type: "expense",
      amount: 2_000_000,
      date: new Date("2026-07-05"),
    });

    // The correction goes through IN FULL — it is not clipped to the available
    // balance. Clipping would leave a 1.000.000 income on the books that nobody
    // ever received: to avoid an ugly number, the app would have forged history.
    await deleteTransaction(userId, badIncome.id);

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-2_000_000);
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

  // The test that used to sit here asserted that an edit past the balance was
  // REJECTED. That behaviour was deliberately reversed (ratified 2026-07-14) —
  // it locked the user inside their own typo. The rule it was defending now
  // lives in "lets an EDIT overdraw the account" above, in the opposite
  // direction. Deleted rather than left skipped: a test of a rule we no longer
  // hold is worse than no test.

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
