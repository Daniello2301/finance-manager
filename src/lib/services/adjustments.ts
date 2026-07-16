import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import { type ITransaction } from "@/lib/models/Transaction";
import { NotFoundError } from "@/lib/errors";
import { createTransaction } from "@/lib/services/transactions";
import {
  ADJUSTMENT_CATEGORY,
  findOrCreateCategory,
} from "@/lib/services/systemCategories";

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

  const category = await findOrCreateCategory(
    userId,
    ADJUSTMENT_CATEGORY,
    "income"
  );

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
