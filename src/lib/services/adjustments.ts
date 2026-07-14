import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Category, { type ICategory } from "@/lib/models/Category";
import { type ITransaction } from "@/lib/models/Transaction";
import { NotFoundError } from "@/lib/errors";
import { createTransaction } from "@/lib/services/transactions";

export const ADJUSTMENT_CATEGORY_NAME = "Ajuste de saldo";

/**
 * The category every balance adjustment lands in, created on first use.
 *
 * It is not one of the 21 categories seeded at signup, and backfilling every
 * existing user would be a migration for a category most of them will never
 * touch. Find-or-create costs one indexed lookup and is correct for both the
 * users who predate this feature and the ones who come after.
 *
 * The unique {userId, name, type} index is the real backstop: two concurrent
 * adjustments can't create it twice.
 */
async function adjustmentCategory(userId: string): Promise<ICategory> {
  const existing = await Category.findOne({
    userId,
    name: ADJUSTMENT_CATEGORY_NAME,
    type: "income",
  });
  if (existing) return existing;

  try {
    return await Category.create({
      userId,
      name: ADJUSTMENT_CATEGORY_NAME,
      type: "income",
      isDefault: true,
    });
  } catch (error) {
    // Lost the race against a concurrent adjustment — the other one created it.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: number }).code === 11000
    ) {
      const raced = await Category.findOne({
        userId,
        name: ADJUSTMENT_CATEGORY_NAME,
        type: "income",
      });
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Recognises money the app didn't know the account had.
 *
 * This is `confirmOverdraft` in a better suit, and that is understood — but the
 * difference is real and it is the whole point: an adjustment is WRITTEN DOWN.
 * It has an amount, a date, a category and a place in the history, so it can be
 * seen, questioned and undone. `confirmOverdraft` left a mute negative balance
 * with no explanation and nothing to audit. One is bookkeeping; the other was
 * giving up.
 *
 * `origin: "adjustment"` keeps it out of "income this month" — the user didn't
 * earn this money, the app simply hadn't heard of it.
 */
export async function adjustAccountBalance(
  userId: string,
  accountId: string,
  input: { amount: number; description?: string }
): Promise<ITransaction> {
  await connectDB();

  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) {
    throw new NotFoundError("La cuenta no existe o no te pertenece");
  }

  const category = await adjustmentCategory(userId);

  return createTransaction(userId, {
    accountId,
    categoryId: category.id,
    type: "income",
    amount: input.amount,
    date: new Date(),
    description: input.description ?? "Saldo que la app no conocía",
    origin: "adjustment",
  });
}
