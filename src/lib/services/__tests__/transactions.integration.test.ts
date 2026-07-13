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
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/lib/services/transactions";

/**
 * Dedicated cross-call invariant check (spec Scenarios 1, 3, 4, 5), distinct
 * from transactions.test.ts's per-function correctness/atomicity tests —
 * this verifies Account.currentBalance stays correct across a *sequence*
 * of service calls, not just one call in isolation.
 */
describe("transactions service — end-to-end balance invariant", () => {
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

  it("keeps Account.currentBalance correct through create -> edit amount -> edit account -> delete", async () => {
    const accountA = await Account.create({
      userId,
      name: "Efectivo",
      type: "cash",
      currency: "COP",
      initialBalance: 100000,
      currentBalance: 100000,
    });
    const accountB = await Account.create({
      userId,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 500000,
      currentBalance: 500000,
    });
    const category = await Category.create({
      userId,
      name: "Alimentación / Mercado",
      type: "expense",
    });

    // Scenario 1: create a 25000 expense on accountA (100000 -> 75000)
    const tx = await createTransaction(userId, {
      accountId: accountA.id,
      categoryId: category.id,
      type: "expense",
      amount: 25000,
      date: new Date("2026-02-01"),
    });
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(75000);

    // Scenario 3: edit the amount to 40000 (75000 + 25000 - 40000 = 60000)
    await updateTransaction(userId, tx.id, { amount: 40000 });
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(60000);

    // Scenario 4: move the transaction to accountB — A recovers 40000
    // (60000 -> 100000), B loses 40000 (500000 -> 460000)
    await updateTransaction(userId, tx.id, { accountId: accountB.id });
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(
      100000
    );
    expect((await Account.findById(accountB.id))!.currentBalance).toBe(
      460000
    );

    // Scenario 5: delete -> accountB reverts to 500000, A untouched
    await deleteTransaction(userId, tx.id);
    expect((await Account.findById(accountB.id))!.currentBalance).toBe(
      500000
    );
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(
      100000
    );
  });

  it("keeps two independent accounts consistent across interleaved transactions", async () => {
    const accountA = await Account.create({
      userId,
      name: "A",
      type: "cash",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });
    const accountB = await Account.create({
      userId,
      name: "B",
      type: "cash",
      currency: "COP",
      initialBalance: 0,
      currentBalance: 0,
    });
    const income = await Category.create({
      userId,
      name: "Salario",
      type: "income",
    });
    const expense = await Category.create({
      userId,
      name: "Transporte",
      type: "expense",
    });

    const tx1 = await createTransaction(userId, {
      accountId: accountA.id,
      categoryId: income.id,
      type: "income",
      amount: 1000000,
      date: new Date(),
    });
    // Deliberately overdraws B: the negative balance is the point, since it's
    // what proves the delta landed on B and not on A. Now that expenses past the
    // available balance need confirming, that intent has to be stated.
    const tx2 = await createTransaction(userId, {
      accountId: accountB.id,
      categoryId: expense.id,
      type: "expense",
      amount: 200000,
      date: new Date(),
      confirmOverdraft: true,
    });

    expect((await Account.findById(accountA.id))!.currentBalance).toBe(
      1000000
    );
    expect((await Account.findById(accountB.id))!.currentBalance).toBe(
      -200000
    );

    await updateTransaction(userId, tx1.id, { amount: 800000 });
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(
      800000
    );
    expect((await Account.findById(accountB.id))!.currentBalance).toBe(
      -200000
    );

    await deleteTransaction(userId, tx2.id);
    expect((await Account.findById(accountB.id))!.currentBalance).toBe(0);
    expect((await Account.findById(accountA.id))!.currentBalance).toBe(
      800000
    );
  });
});
