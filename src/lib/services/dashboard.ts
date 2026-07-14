import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Transaction, { type ITransaction } from "@/lib/models/Transaction";
import { getBudgetProgress, periodRange, type BudgetProgress } from "@/lib/services/budgets";
import { getCurrentPeriodKey, getLastPeriodKeys } from "@/lib/period";

export interface BalanceByCurrency {
  currency: string;
  total: number;
}

export async function getBalanceSummary(
  userId: string
): Promise<BalanceByCurrency[]> {
  await connectDB();

  const accounts = await Account.findForUser(userId, { isArchived: false });
  const totals = new Map<string, number>();
  for (const account of accounts) {
    totals.set(
      account.currency,
      (totals.get(account.currency) ?? 0) + account.currentBalance
    );
  }

  return Array.from(totals.entries()).map(([currency, total]) => ({
    currency,
    total,
  }));
}

export interface MonthlyTrendEntry {
  month: string;
  income: number;
  expense: number;
}

export async function getMonthlyTrend(
  userId: string,
  months = 6
): Promise<MonthlyTrendEntry[]> {
  await connectDB();

  const periodKeys = getLastPeriodKeys(months);
  const since = periodRange(periodKeys[0]).periodStart;

  const results = await Transaction.aggregate<{
    _id: { month: string; type: "income" | "expense" };
    total: number;
  }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        date: { $gte: since },
        // Excludes disbursements and balance adjustments. They credit an account
        // like a salary does, but the user did not EARN that money — one was
        // borrowed, the other was already there and the app hadn't heard of it.
        // Counting them would report a month where you took on debt as a month
        // where you did well.
        origin: { $exists: false },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: "%Y-%m", date: "$date" } },
          type: "$type",
        },
        total: { $sum: "$amount" },
      },
    },
  ]);

  // Every requested month appears in the output, even with zero
  // transactions — a chart that silently omits empty months is
  // indistinguishable from a broken one.
  const byMonth = new Map<string, { income: number; expense: number }>(
    periodKeys.map((key) => [key, { income: 0, expense: 0 }])
  );
  for (const result of results) {
    const entry = byMonth.get(result._id.month);
    if (!entry) continue;
    if (result._id.type === "income") {
      entry.income = result.total;
    } else {
      entry.expense = result.total;
    }
  }

  return periodKeys.map((month) => ({ month, ...byMonth.get(month)! }));
}

export interface CategoryBreakdownEntry {
  categoryId: mongoose.Types.ObjectId;
  categoryName: string;
  total: number;
}

export async function getCategoryBreakdown(
  userId: string,
  periodKey: string
): Promise<CategoryBreakdownEntry[]> {
  await connectDB();

  const { periodStart, periodEnd } = periodRange(periodKey);

  const results = await Transaction.aggregate<{
    _id: mongoose.Types.ObjectId;
    total: number;
    category: { name: string };
  }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: "expense",
        date: { $gte: periodStart, $lt: periodEnd },
      },
    },
    { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: "$category" },
    { $sort: { total: -1 } },
  ]);

  return results.map((result) => ({
    categoryId: result._id,
    categoryName: result.category.name,
    total: result.total,
  }));
}

export async function getRecentTransactions(
  userId: string,
  limit = 10
): Promise<ITransaction[]> {
  await connectDB();

  return Transaction.findForUser(userId)
    .sort({ date: -1, _id: -1 })
    .limit(limit);
}

export async function getTopBudgets(
  userId: string,
  limit = 5
): Promise<BudgetProgress[]> {
  const progress = await getBudgetProgress(userId, getCurrentPeriodKey());
  return [...progress]
    .sort((a, b) => b.percentUsed - a.percentUsed)
    .slice(0, limit);
}
