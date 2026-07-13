import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Budget, { type IBudget } from "@/lib/models/Budget";
import Transaction from "@/lib/models/Transaction";

export interface PeriodRange {
  periodStart: Date;
  periodEnd: Date;
}

/**
 * `periodEnd` is exclusive (first day of the *next* month) so callers can
 * use a plain `$gte periodStart, $lt periodEnd` range — `new Date(year, 12, 1)`
 * correctly rolls over to January of the following year, no special-casing
 * December.
 */
export function periodRange(periodKey: string): PeriodRange {
  const [year, month] = periodKey.split("-").map(Number);
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 1),
  };
}

export interface BudgetProgress {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  categoryId: mongoose.Types.ObjectId;
  periodKey: string;
  periodStart: Date;
  limitAmount: number;
  currency: string;
  spentAmount: number;
  percentUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function getBudgetProgress(
  userId: string,
  periodKey: string
): Promise<BudgetProgress[]> {
  await connectDB();

  const budgets = await Budget.findForUser(userId, { periodKey });
  const { periodStart, periodEnd } = periodRange(periodKey);

  const spentByCategory = await Transaction.aggregate<{
    _id: mongoose.Types.ObjectId;
    spent: number;
  }>([
    {
      $match: {
        // aggregate() does not auto-cast string ids the way find() does —
        // without this, $match silently matches nothing.
        userId: new mongoose.Types.ObjectId(userId),
        type: "expense",
        date: { $gte: periodStart, $lt: periodEnd },
      },
    },
    { $group: { _id: "$categoryId", spent: { $sum: "$amount" } } },
  ]);

  const spentMap = new Map(
    spentByCategory.map((entry) => [entry._id.toString(), entry.spent])
  );

  return budgets.map((budget) => {
    const spentAmount = spentMap.get(budget.categoryId.toString()) ?? 0;
    return {
      ...budget.toObject(),
      spentAmount,
      percentUsed: Math.round((spentAmount / budget.limitAmount) * 100),
    };
  });
}

export async function copyBudgets(
  userId: string,
  fromPeriod: string,
  toPeriod: string
): Promise<IBudget[]> {
  await connectDB();

  const source = await Budget.findForUser(userId, { periodKey: fromPeriod });
  const existing = await Budget.findForUser(userId, { periodKey: toPeriod });
  const existingCategoryIds = new Set(
    existing.map((budget) => budget.categoryId.toString())
  );

  const toCreate = source
    .filter((budget) => !existingCategoryIds.has(budget.categoryId.toString()))
    .map((budget) => ({
      userId: new mongoose.Types.ObjectId(userId),
      categoryId: budget.categoryId,
      periodKey: toPeriod,
      periodStart: periodRange(toPeriod).periodStart,
      limitAmount: budget.limitAmount,
      currency: budget.currency,
    }));

  if (toCreate.length === 0) {
    return [];
  }

  return Budget.insertMany(toCreate);
}
