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
import RecurringTransaction from "@/lib/models/RecurringTransaction";
import { InsufficientFundsError } from "@/lib/errors";
import {
  catchUp,
  confirmOccurrence,
  pendingConfirmations,
  skipOccurrence,
} from "@/lib/services/recurring";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("recurring service", () => {
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

  async function seedAccount(currentBalance = 1_000_000) {
    const account = await Account.create({
      userId,
      name: "Nu",
      type: "bank",
      currency: "COP",
      initialBalance: currentBalance,
      currentBalance,
    });
    return account._id.toString();
  }

  async function seedCategory(type: "income" | "expense" = "expense") {
    const category = await Category.create({ userId, name: "Suscripciones", type });
    return category._id.toString();
  }

  type RecurringOverrides = Partial<{
    accountId: string;
    categoryId: string;
    name: string;
    type: "income" | "expense";
    amount: number;
    frequency: "weekly" | "biweekly" | "monthly" | "yearly";
    anchorDay: number;
    startDate: Date;
    nextDueDate: Date;
    endDate: Date;
    autoGenerate: boolean;
    isPaused: boolean;
    isArchived: boolean;
  }>;

  async function seedRecurring(overrides: RecurringOverrides = {}) {
    const accountId = overrides.accountId ?? (await seedAccount());
    const categoryId = overrides.categoryId ?? (await seedCategory());
    return RecurringTransaction.create({
      userId,
      name: "Netflix",
      type: "expense",
      amount: 44_900,
      frequency: "monthly",
      anchorDay: 20,
      startDate: utc("2026-07-20"),
      nextDueDate: utc("2026-07-20"),
      autoGenerate: true,
      isPaused: false,
      isArchived: false,
      ...overrides,
      accountId,
      categoryId,
    });
  }

  // Scenario 2
  it("materialises an automatic occurrence and advances the due date", async () => {
    const accountId = await seedAccount(500_000);
    const rec = await seedRecurring({ accountId });

    const { created } = await catchUp(userId, utc("2026-07-21"));
    expect(created).toBe(1);

    const txs = await Transaction.find({ recurringTransactionId: rec.id });
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe(44_900);
    expect(txs[0].recurringOccurrenceKey).toBe("2026-07-20");

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(455_100);

    const after = await RecurringTransaction.findById(rec.id);
    expect(after?.nextDueDate.toISOString().slice(0, 10)).toBe("2026-08-20");
  });

  // Scenario 3 — the one that breaks in production, not in a demo.
  it("does not duplicate when catch-up runs twice", async () => {
    const rec = await seedRecurring();

    await catchUp(userId, utc("2026-07-21"));
    const second = await catchUp(userId, utc("2026-07-21"));

    expect(second.created).toBe(0);
    expect(
      await Transaction.countDocuments({ recurringTransactionId: rec.id })
    ).toBe(1);
  });

  // Scenario 4
  it("catches up every missed occurrence after months away", async () => {
    const rec = await seedRecurring({
      anchorDay: 5,
      startDate: utc("2026-05-05"),
      nextDueDate: utc("2026-06-05"),
    });

    const { created } = await catchUp(userId, utc("2026-07-14"));
    expect(created).toBe(2);

    const keys = (
      await Transaction.find({ recurringTransactionId: rec.id }).sort({ date: 1 })
    ).map((t) => t.recurringOccurrenceKey);
    expect(keys).toEqual(["2026-06-05", "2026-07-05"]);

    const after = await RecurringTransaction.findById(rec.id);
    expect(after?.nextDueDate.toISOString().slice(0, 10)).toBe("2026-08-05");
  });

  // Scenario 7 — a consummated fact is recorded even into the red.
  it("records an automatic charge that overdraws the account", async () => {
    const accountId = await seedAccount(100_000);
    await seedRecurring({ accountId, amount: 300_000 });

    const { created } = await catchUp(userId, utc("2026-07-21"));
    expect(created).toBe(1);

    const account = await Account.findById(accountId);
    expect(account?.currentBalance).toBe(-200_000);
  });

  it("ignores paused, archived and manual templates", async () => {
    // Shared account/category so the three templates don't collide on the
    // unique {userId, name, type} category index.
    const accountId = await seedAccount();
    const categoryId = await seedCategory();
    await seedRecurring({ accountId, categoryId, isPaused: true });
    await seedRecurring({ accountId, categoryId, isArchived: true });
    await seedRecurring({ accountId, categoryId, autoGenerate: false });

    const { created } = await catchUp(userId, utc("2026-07-21"));
    expect(created).toBe(0);
    expect(await Transaction.countDocuments({ userId })).toBe(0);
  });

  it("does not generate past endDate (FR-009)", async () => {
    const rec = await seedRecurring({
      anchorDay: 5,
      startDate: utc("2026-05-05"),
      nextDueDate: utc("2026-05-05"),
      endDate: utc("2026-06-05"),
    });

    const { created } = await catchUp(userId, utc("2026-09-14"));
    expect(created).toBe(2); // May and June only

    const keys = (
      await Transaction.find({ recurringTransactionId: rec.id }).sort({ date: 1 })
    ).map((t) => t.recurringOccurrenceKey);
    expect(keys).toEqual(["2026-05-05", "2026-06-05"]);
  });

  describe("manual templates", () => {
    it("lists an overdue manual template as pending, with the earliest occurrence", async () => {
      await seedRecurring({
        name: "Energía",
        amount: 180_000,
        autoGenerate: false,
        anchorDay: 10,
        startDate: utc("2026-06-10"),
        nextDueDate: utc("2026-06-10"),
      });

      const pending = await pendingConfirmations(userId, utc("2026-07-14"));
      expect(pending).toHaveLength(1);
      expect(pending[0].occurrenceKey).toBe("2026-06-10");
      expect(pending[0].overdueCount).toBe(2);
      // Nothing was created just by listing.
      expect(await Transaction.countDocuments({ userId })).toBe(0);
    });

    // Scenario 5
    it("confirms at a corrected amount without changing the template", async () => {
      const accountId = await seedAccount(1_000_000);
      const rec = await seedRecurring({
        name: "Energía",
        amount: 180_000,
        accountId,
        autoGenerate: false,
        anchorDay: 10,
        startDate: utc("2026-07-10"),
        nextDueDate: utc("2026-07-10"),
      });

      await confirmOccurrence(userId, rec.id, "2026-07-10", 214_300, utc("2026-07-14"));

      const tx = await Transaction.findOne({ recurringTransactionId: rec.id });
      expect(tx?.amount).toBe(214_300);

      const account = await Account.findById(accountId);
      expect(account?.currentBalance).toBe(785_700);

      const after = await RecurringTransaction.findById(rec.id);
      expect(after?.amount).toBe(180_000); // template unchanged
      expect(after?.nextDueDate.toISOString().slice(0, 10)).toBe("2026-08-10");
    });

    it("rejects confirming an occurrence that isn't the current pending one", async () => {
      const rec = await seedRecurring({
        autoGenerate: false,
        nextDueDate: utc("2026-07-20"),
      });

      await expect(
        confirmOccurrence(userId, rec.id, "2026-08-20", undefined, utc("2026-07-21"))
      ).rejects.toThrow();
    });

    // Scenario 6
    it("skips an occurrence without creating anything, advancing the date", async () => {
      const accountId = await seedAccount(1_000_000);
      const rec = await seedRecurring({
        accountId,
        autoGenerate: false,
        anchorDay: 10,
        startDate: utc("2026-07-10"),
        nextDueDate: utc("2026-07-10"),
      });

      await skipOccurrence(userId, rec.id, "2026-07-10", utc("2026-07-14"));

      expect(await Transaction.countDocuments({ recurringTransactionId: rec.id })).toBe(0);
      const account = await Account.findById(accountId);
      expect(account?.currentBalance).toBe(1_000_000);
      const after = await RecurringTransaction.findById(rec.id);
      expect(after?.nextDueDate.toISOString().slice(0, 10)).toBe("2026-08-10");
    });

    // A manual confirm is a decision, so it is NOT allowed to overdraw.
    it("blocks a manual confirm that would overdraw the account", async () => {
      const accountId = await seedAccount(100_000);
      const rec = await seedRecurring({
        accountId,
        amount: 300_000,
        autoGenerate: false,
        anchorDay: 10,
        startDate: utc("2026-07-10"),
        nextDueDate: utc("2026-07-10"),
      });

      await expect(
        confirmOccurrence(userId, rec.id, "2026-07-10", undefined, utc("2026-07-14"))
      ).rejects.toBeInstanceOf(InsufficientFundsError);

      // Nothing materialised, due date not advanced.
      expect(await Transaction.countDocuments({ recurringTransactionId: rec.id })).toBe(0);
      const after = await RecurringTransaction.findById(rec.id);
      expect(after?.nextDueDate.toISOString().slice(0, 10)).toBe("2026-07-10");
    });
  });
});
