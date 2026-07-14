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
import Debt from "@/lib/models/Debt";
import Transaction from "@/lib/models/Transaction";
import { InsufficientFundsError, NotFoundError } from "@/lib/errors";
import { updateTransaction } from "@/lib/services/transactions";
import {
  getDebtState,
  getDebtSummary,
  listDebtsWithState,
  payDebt,
} from "@/lib/services/debts";

/**
 * The maths is covered exhaustively in src/lib/__tests__/debt-math.test.ts, on
 * pure functions with no database. What's tested here is the wiring: that a debt
 * payment is a real transaction which really moves a real account balance, and
 * that nothing about it is special-cased.
 *
 * Needs the replica set, not the standalone server: payments go through
 * createTransaction, which uses session.withTransaction().
 */
describe("debts service", () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const otherUserId = new mongoose.Types.ObjectId().toString();

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

  async function seed(owner = userId) {
    const account = await Account.create({
      userId: owner,
      name: "Ahorros",
      type: "bank",
      currency: "COP",
      initialBalance: 20_000_000,
      currentBalance: 20_000_000,
    });
    const category = await Category.create({
      userId: owner,
      name: "Deudas",
      type: "expense",
    });
    const debt = await Debt.create({
      userId: owner,
      name: "Préstamo",
      principal: 17_000_000,
      monthlyRate: 0.015,
      startDate: new Date("2026-01-01T00:00:00.000Z"),
    });
    return { account, category, debt };
  }

  // The disbursement is an INCOME transaction carrying a debtId: the borrowed
  // money arriving in an account. `paymentsFor()` used to read every transaction
  // with that debtId, so it swallowed the disbursement as if it were a payment —
  // and the debt was paid off with the very money it had lent. A 17.000.000 debt
  // reported a balance of zero the moment its disbursement was recorded.
  //
  // It never crashed. It just returned a false number about the owner's money,
  // which is the only kind of bug this module can actually have.
  it("does NOT count the disbursement (an income) as a payment", async () => {
    const { account, debt } = await seed();

    await Transaction.create({
      userId,
      accountId: account.id,
      categoryId: (
        await Category.create({ userId, name: "Préstamos", type: "income" })
      ).id,
      type: "income",
      amount: 17_000_000,
      currency: "COP",
      date: new Date("2026-01-01T00:00:00.000Z"),
      debtId: debt.id,
      origin: "disbursement",
    });

    const { state } = await getDebtState(userId, debt.id);

    expect(state.payments).toHaveLength(0);
    // Still owed in full — the money that arrived is not a payment towards itself.
    expect(state.outstanding).toBeGreaterThanOrEqual(17_000_000);
  });

  it("records a payment as a real transaction that moves the account balance", async () => {
    const { account, category, debt } = await seed();

    const tx = await payDebt(userId, debt.id, {
      accountId: account.id,
      categoryId: category.id,
      amount: 255_000,
      date: new Date("2026-01-15T00:00:00.000Z"),
    });

    // It's an ordinary expense — it just carries a debtId.
    expect(tx.type).toBe("expense");
    expect(tx.debtId?.toString()).toBe(debt.id);
    expect(tx.currency).toBe("COP");

    const reloaded = await Account.findById(account.id);
    expect(reloaded?.currentBalance).toBe(20_000_000 - 255_000);

    // And it shows up in the transaction history like anything else.
    expect(await Transaction.countDocuments({ userId })).toBe(1);
  });

  it("splits the payment against the debt when read back", async () => {
    const { account, category, debt } = await seed();

    await payDebt(userId, debt.id, {
      accountId: account.id,
      categoryId: category.id,
      amount: 3_000_000,
      date: new Date("2026-01-15T00:00:00.000Z"),
    });

    const { state } = await getDebtState(userId, debt.id);
    expect(state.payments[0].interest).toBe(255_000);
    expect(state.payments[0].principal).toBe(2_745_000);
    expect(state.outstanding).toBe(14_255_000);
  });

  it("asks for confirmation when paying with money the account doesn't have", async () => {
    const { category, debt } = await seed();
    const broke = await Account.create({
      userId,
      name: "Efectivo",
      type: "cash",
      currency: "COP",
      initialBalance: 50_000,
      currentBalance: 50_000,
    });

    // Inherited from Fase A for free, because payDebt delegates to
    // createTransaction rather than reimplementing the balance update.
    await expect(
      payDebt(userId, debt.id, {
        accountId: broke.id,
        categoryId: category.id,
        amount: 255_000,
        date: new Date("2026-01-15T00:00:00.000Z"),
      })
    ).rejects.toBeInstanceOf(InsufficientFundsError);

    expect((await Account.findById(broke.id))?.currentBalance).toBe(50_000);
  });

  // Identified as a risk in the plan: updateTransaction does an
  // Object.assign(existing, fields), and a stray `debtId: undefined` would
  // orphan the payment from its debt.
  it("keeps a payment linked to its debt when the payment is edited", async () => {
    const { account, category, debt } = await seed();

    const tx = await payDebt(userId, debt.id, {
      accountId: account.id,
      categoryId: category.id,
      amount: 255_000,
      date: new Date("2026-01-15T00:00:00.000Z"),
    });

    await updateTransaction(userId, tx.id, { amount: 300_000 });

    const reloaded = await Transaction.findById(tx.id);
    expect(reloaded?.debtId?.toString()).toBe(debt.id);

    // And the debt sees the edited figure.
    const { state } = await getDebtState(userId, debt.id);
    expect(state.totalPaid).toBe(300_000);
  });

  it("refuses to pay another user's debt, with a 404 rather than a 403", async () => {
    const mine = await seed();
    const theirs = await seed(otherUserId);

    await expect(
      payDebt(userId, theirs.debt.id, {
        accountId: mine.account.id,
        categoryId: mine.category.id,
        amount: 100_000,
        date: new Date("2026-01-15T00:00:00.000Z"),
      })
    ).rejects.toBeInstanceOf(NotFoundError);

    await expect(getDebtState(userId, theirs.debt.id)).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("does not leak another user's debts into the list", async () => {
    await seed();
    await seed(otherUserId);

    const debts = await listDebtsWithState(userId);
    expect(debts).toHaveLength(1);
  });

  it("counts what's outstanding, and says how much it cannot count", async () => {
    await seed();
    // A debt with nothing but a name — the ADDI case.
    await Debt.create({ userId, name: "ADDI", installmentAmount: 150_000 });

    const summary = await getDebtSummary(
      userId,
      new Date("2026-01-31T00:00:00.000Z")
    );

    expect(summary.activeCount).toBe(2);
    expect(summary.totalOutstanding).toBe(17_000_000);
    // The second debt has no principal, so it contributes nothing to the total —
    // and the total says so, instead of quietly understating the situation.
    expect(summary.unknownCount).toBe(1);
    expect(summary.monthlyDue).toBe(150_000);
    // January's interest accrued and nothing was paid.
    expect(summary.debtsInArrears).toBe(1);
  });
});
