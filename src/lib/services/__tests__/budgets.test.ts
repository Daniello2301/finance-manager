import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Budget from "@/lib/models/Budget";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import {
  copyBudgets,
  getBudgetProgress,
  periodRange,
} from "@/lib/services/budgets";

describe("periodRange", () => {
  it("computes the start and exclusive end of a mid-year month", () => {
    const { periodStart, periodEnd } = periodRange("2026-07");
    expect(periodStart).toEqual(new Date(2026, 6, 1));
    expect(periodEnd).toEqual(new Date(2026, 7, 1));
  });

  it("rolls over into January of the next year for December", () => {
    const { periodStart, periodEnd } = periodRange("2026-12");
    expect(periodStart).toEqual(new Date(2026, 11, 1));
    expect(periodEnd).toEqual(new Date(2027, 0, 1));
  });

  it("handles the first month of the year", () => {
    const { periodStart, periodEnd } = periodRange("2026-01");
    expect(periodStart).toEqual(new Date(2026, 0, 1));
    expect(periodEnd).toEqual(new Date(2026, 1, 1));
  });
});

describe("budgets service", () => {
  const userId = new mongoose.Types.ObjectId().toString();

  beforeAll(async () => {
    await startTestDb();
    await connectDB();
  }, 30000);

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await stopTestDb();
  });

  let categoryCounter = 0;
  async function seedCategory(type: "income" | "expense" = "expense") {
    categoryCounter += 1;
    return Category.create({ userId, name: `Categoria ${categoryCounter}`, type });
  }

  async function seedBudget(
    categoryId: string,
    periodKey: string,
    limitAmount: number
  ) {
    return Budget.create({
      userId,
      categoryId,
      periodKey,
      periodStart: periodRange(periodKey).periodStart,
      limitAmount,
      currency: "COP",
    });
  }

  async function seedTransaction(
    categoryId: string,
    type: "income" | "expense",
    amount: number,
    date: Date
  ) {
    const accountId = new mongoose.Types.ObjectId();
    return Transaction.create({
      userId,
      accountId,
      categoryId,
      type,
      amount,
      currency: "COP",
      date,
    });
  }

  describe("getBudgetProgress", () => {
    it("aggregates real spend per category for the given period", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 600000);
      await seedTransaction(category.id, "expense", 300000, new Date(2026, 6, 5));
      await seedTransaction(category.id, "expense", 150000, new Date(2026, 6, 20));

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.spentAmount).toBe(450000);
      expect(progress.percentUsed).toBe(75);
    });

    it("returns 0 spent when there are no matching transactions", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 600000);

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.spentAmount).toBe(0);
      expect(progress.percentUsed).toBe(0);
    });

    it("ignores transactions outside the requested period", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 600000);
      // June and August transactions must not count toward July's spend.
      await seedTransaction(category.id, "expense", 999999, new Date(2026, 5, 30));
      await seedTransaction(category.id, "expense", 999999, new Date(2026, 7, 1));

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.spentAmount).toBe(0);
    });

    it("ignores income transactions", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 600000);
      await seedTransaction(category.id, "income", 500000, new Date(2026, 6, 10));

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.spentAmount).toBe(0);
    });

    it("does not leak another user's transactions into the aggregate", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 600000);

      const otherUserId = new mongoose.Types.ObjectId();
      await Transaction.create({
        userId: otherUserId,
        accountId: new mongoose.Types.ObjectId(),
        categoryId: category.id,
        type: "expense",
        amount: 999999,
        currency: "COP",
        date: new Date(2026, 6, 10),
      });

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.spentAmount).toBe(0);
    });

    it("percentUsed can exceed 100 when overspent", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-07", 100000);
      await seedTransaction(category.id, "expense", 150000, new Date(2026, 6, 5));

      const [progress] = await getBudgetProgress(userId, "2026-07");
      expect(progress.percentUsed).toBe(150);
    });
  });

  describe("copyBudgets", () => {
    it("copies budgets from one period into another", async () => {
      const category1 = await seedCategory("expense");
      const category2 = await seedCategory("expense");
      await seedBudget(category1.id, "2026-06", 500000);
      await seedBudget(category2.id, "2026-06", 200000);

      const created = await copyBudgets(userId, "2026-06", "2026-07");
      expect(created).toHaveLength(2);

      const julyBudgets = await Budget.findForUser(userId, {
        periodKey: "2026-07",
      });
      expect(julyBudgets).toHaveLength(2);
      expect(julyBudgets.map((b) => b.limitAmount).sort()).toEqual([
        200000, 500000,
      ]);
    });

    it("does not duplicate or overwrite a budget that already exists in the target period", async () => {
      const category = await seedCategory("expense");
      await seedBudget(category.id, "2026-06", 500000);
      await seedBudget(category.id, "2026-07", 999999);

      const created = await copyBudgets(userId, "2026-06", "2026-07");
      expect(created).toHaveLength(0);

      const julyBudgets = await Budget.findForUser(userId, {
        periodKey: "2026-07",
      });
      expect(julyBudgets).toHaveLength(1);
      expect(julyBudgets[0].limitAmount).toBe(999999);
    });

    it("only copies missing categories, leaving existing ones untouched", async () => {
      const existingCategory = await seedCategory("expense");
      const newCategory = await seedCategory("expense");
      await seedBudget(existingCategory.id, "2026-06", 500000);
      await seedBudget(newCategory.id, "2026-06", 300000);
      await seedBudget(existingCategory.id, "2026-07", 111111);

      const created = await copyBudgets(userId, "2026-06", "2026-07");
      expect(created).toHaveLength(1);
      expect(created[0].categoryId.toString()).toBe(newCategory.id);

      const julyBudgets = await Budget.findForUser(userId, {
        periodKey: "2026-07",
      });
      expect(julyBudgets).toHaveLength(2);
    });
  });
});
