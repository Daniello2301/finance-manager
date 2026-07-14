import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  clearTestDb,
  startTestDb,
  stopTestDb,
} from "@/lib/test-utils/mongoMemoryServer";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Budget from "@/lib/models/Budget";
import Category from "@/lib/models/Category";
import Transaction from "@/lib/models/Transaction";
import { periodRange } from "@/lib/services/budgets";
import {
  getBalanceSummary,
  getCategoryBreakdown,
  getMonthlyTrend,
  getRecentTransactions,
  getTopBudgets,
} from "@/lib/services/dashboard";

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

describe("dashboard service", () => {
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
    return Category.create({
      userId,
      name: `Categoria ${categoryCounter}`,
      type,
    });
  }

  async function seedAccount(currentBalance: number, currency = "COP") {
    return Account.create({
      userId,
      name: "Cuenta",
      type: "bank",
      currency,
      initialBalance: currentBalance,
      currentBalance,
      isArchived: false,
    });
  }

  async function seedTransaction(
    categoryId: string,
    type: "income" | "expense",
    amount: number,
    date: Date
  ) {
    return Transaction.create({
      userId,
      accountId: new mongoose.Types.ObjectId(),
      categoryId,
      type,
      amount,
      currency: "COP",
      date,
    });
  }

  describe("getBalanceSummary", () => {
    it("sums balances grouped by currency", async () => {
      await seedAccount(500000, "COP");
      await seedAccount(-200000, "COP");
      await seedAccount(1000000, "COP");

      const summary = await getBalanceSummary(userId);
      expect(summary).toEqual([{ currency: "COP", total: 1300000 }]);
    });

    it("keeps multiple currencies separate, without converting", async () => {
      await seedAccount(500000, "COP");
      await seedAccount(100, "USD");

      const summary = await getBalanceSummary(userId);
      expect(summary).toHaveLength(2);
      expect(summary).toEqual(
        expect.arrayContaining([
          { currency: "COP", total: 500000 },
          { currency: "USD", total: 100 },
        ])
      );
    });

    it("excludes archived accounts", async () => {
      await seedAccount(500000, "COP");
      const archived = await seedAccount(999999, "COP");
      await Account.findByIdAndUpdate(archived.id, { isArchived: true });

      const summary = await getBalanceSummary(userId);
      expect(summary).toEqual([{ currency: "COP", total: 500000 }]);
    });

    it("returns an empty array for a user with no accounts", async () => {
      const summary = await getBalanceSummary(userId);
      expect(summary).toEqual([]);
    });
  });

  describe("getMonthlyTrend", () => {
    it("includes months with no transactions as zero, not omitted", async () => {
      const category = await seedCategory("expense");
      // Only seed a transaction in the most recent of a 3-month window —
      // the other two months must still appear with income/expense = 0.
      await seedTransaction(category.id, "expense", 50000, new Date());

      const trend = await getMonthlyTrend(userId, 3);
      expect(trend).toHaveLength(3);
      expect(trend[0].income).toBe(0);
      expect(trend[0].expense).toBe(0);
      expect(trend[2].expense).toBe(50000);
    });

    // A disbursement (borrowed money) and an adjustment (money the app hadn't
    // heard of) both credit an account exactly like a salary — but the user
    // EARNED neither. Counting them would report the month you took on a debt as
    // a month you did well, which is the most dangerous kind of wrong this app
    // can be: it reads as good news.
    it("excludes disbursements and adjustments from income", async () => {
      const incomeCategory = await seedCategory("income");
      const now = new Date();

      await seedTransaction(incomeCategory.id, "income", 900_000, now);
      await Transaction.create({
        userId,
        accountId: new mongoose.Types.ObjectId(),
        categoryId: incomeCategory.id,
        type: "income",
        amount: 5_000_000,
        currency: "COP",
        date: now,
        origin: "disbursement",
      });
      await Transaction.create({
        userId,
        accountId: new mongoose.Types.ObjectId(),
        categoryId: incomeCategory.id,
        type: "income",
        amount: 300_000,
        currency: "COP",
        date: now,
        origin: "adjustment",
      });

      const trend = await getMonthlyTrend(userId, 1);
      expect(trend[0].income).toBe(900_000);
    });

    it("sums income and expense separately per month", async () => {
      const expenseCategory = await seedCategory("expense");
      const incomeCategory = await seedCategory("income");
      const now = new Date();
      await seedTransaction(expenseCategory.id, "expense", 100000, now);
      await seedTransaction(expenseCategory.id, "expense", 50000, now);
      await seedTransaction(incomeCategory.id, "income", 900000, now);

      const trend = await getMonthlyTrend(userId, 1);
      expect(trend).toHaveLength(1);
      expect(trend[0].expense).toBe(150000);
      expect(trend[0].income).toBe(900000);
    });

    it("excludes transactions outside the requested window", async () => {
      const category = await seedCategory("expense");
      const outsideWindow = new Date();
      outsideWindow.setMonth(outsideWindow.getMonth() - 6);
      await seedTransaction(category.id, "expense", 999999, outsideWindow);

      const trend = await getMonthlyTrend(userId, 3);
      const total = trend.reduce((sum, entry) => sum + entry.expense, 0);
      expect(total).toBe(0);
    });
  });

  describe("getCategoryBreakdown", () => {
    it("aggregates expense totals per category, sorted descending", async () => {
      const groceries = await seedCategory("expense");
      const transport = await seedCategory("expense");
      const period = currentPeriodKey();
      const { periodStart } = periodRange(period);
      await seedTransaction(groceries.id, "expense", 300000, periodStart);
      await seedTransaction(transport.id, "expense", 200000, periodStart);

      const breakdown = await getCategoryBreakdown(userId, period);
      expect(breakdown).toHaveLength(2);
      expect(breakdown[0].categoryName).toBe(groceries.name);
      expect(breakdown[0].total).toBe(300000);
      expect(breakdown[1].categoryName).toBe(transport.name);
    });

    it("ignores income transactions", async () => {
      const category = await seedCategory("income");
      const period = currentPeriodKey();
      const { periodStart } = periodRange(period);
      await seedTransaction(category.id, "income", 900000, periodStart);

      const breakdown = await getCategoryBreakdown(userId, period);
      expect(breakdown).toEqual([]);
    });

    it("ignores transactions outside the requested period", async () => {
      const category = await seedCategory("expense");
      const period = currentPeriodKey();
      const outside = new Date(2020, 0, 1);
      await seedTransaction(category.id, "expense", 999999, outside);

      const breakdown = await getCategoryBreakdown(userId, period);
      expect(breakdown).toEqual([]);
    });
  });

  describe("getRecentTransactions", () => {
    it("returns the most recent transactions first, capped at limit", async () => {
      const category = await seedCategory("expense");
      await seedTransaction(category.id, "expense", 1000, new Date(2026, 0, 1));
      await seedTransaction(category.id, "expense", 2000, new Date(2026, 0, 3));
      await seedTransaction(category.id, "expense", 3000, new Date(2026, 0, 2));

      const recent = await getRecentTransactions(userId, 2);
      expect(recent).toHaveLength(2);
      expect(recent[0].amount).toBe(2000);
      expect(recent[1].amount).toBe(3000);
    });
  });

  describe("getTopBudgets", () => {
    it("returns budgets sorted by percentUsed descending, capped at limit", async () => {
      const period = currentPeriodKey();
      const { periodStart } = periodRange(period);
      const catLow = await seedCategory("expense");
      const catHigh = await seedCategory("expense");
      await Budget.create({
        userId,
        categoryId: catLow.id,
        periodKey: period,
        periodStart,
        limitAmount: 1000000,
        currency: "COP",
      });
      await Budget.create({
        userId,
        categoryId: catHigh.id,
        periodKey: period,
        periodStart,
        limitAmount: 100000,
        currency: "COP",
      });
      await seedTransaction(catLow.id, "expense", 100000, periodStart);
      await seedTransaction(catHigh.id, "expense", 90000, periodStart);

      const top = await getTopBudgets(userId, 5);
      expect(top).toHaveLength(2);
      expect(top[0].categoryId.toString()).toBe(catHigh.id);
      expect(top[0].percentUsed).toBe(90);
      expect(top[1].percentUsed).toBe(10);
    });
  });
});
