import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import { type ITransaction } from "@/lib/models/Transaction";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createTransactionInSession } from "@/lib/services/transactions";
import {
  TRANSFER_CATEGORY,
  findOrCreateCategory,
} from "@/lib/services/systemCategories";

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date?: Date;
  description?: string;
}

export interface Transfer {
  /** The leg that leaves the source account. */
  out: ITransaction;
  /** The leg that lands in the destination account. */
  in: ITransaction;
}

/**
 * Moves money between two of the user's own accounts.
 *
 * The missing primitive: until now a credit card's balance could only ever get
 * more negative, because there was no way to record paying it off. Nobody
 * noticed because a card had only ever been a place to log purchases.
 *
 * A transfer is NOT income and NOT spending — you neither earned nor spent
 * 800.000 by paying your card, it is the same 800.000 in a different place. Both
 * legs carry `origin: "transfer"`, which already keeps them out of every report
 * (`getMonthlyTrend` excludes anything with an `origin`). That field has now
 * earned its keep three times over.
 */
export async function transferMoney(
  userId: string,
  input: TransferInput
): Promise<Transfer> {
  await connectDB();

  if (input.fromAccountId === input.toAccountId) {
    throw new ValidationError("No puedes transferir a la misma cuenta");
  }

  // Ownership checked before the write, and by id — a transfer to an account
  // that isn't yours must 404, not silently create half of itself.
  const accounts = await Account.find({
    _id: { $in: [input.fromAccountId, input.toAccountId] },
    userId,
  });
  if (accounts.length !== 2) {
    throw new NotFoundError("Alguna de las cuentas no existe o no te pertenece");
  }

  const [expenseCategory, incomeCategory] = await Promise.all([
    findOrCreateCategory(userId, TRANSFER_CATEGORY, "expense"),
    findOrCreateCategory(userId, TRANSFER_CATEGORY, "income"),
  ]);

  const date = input.date ?? new Date();
  const transferId = new mongoose.Types.ObjectId();

  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      // Both legs inside ONE Mongo transaction. Half a transfer — money leaving
      // one account and never arriving at the other — is money destroyed. That's
      // why createTransactionInSession exists: Mongo won't nest withTransaction,
      // so the session is threaded in instead of started again.
      const out = await createTransactionInSession(
        userId,
        {
          accountId: input.fromAccountId,
          categoryId: expenseCategory.id,
          type: "expense",
          amount: input.amount,
          date,
          description: input.description,
          origin: "transfer",
          transferId,
        },
        session
      );

      // Insufficient funds on the source leg throws from inside here and rolls
      // the whole thing back: transferring money you don't have is a DECISION,
      // so it is blocked like any other expense, and the user gets the same fork.
      const incoming = await createTransactionInSession(
        userId,
        {
          accountId: input.toAccountId,
          categoryId: incomeCategory.id,
          type: "income",
          amount: input.amount,
          date,
          description: input.description,
          origin: "transfer",
          transferId,
        },
        session
      );

      return { out, in: incoming };
    });
  } finally {
    await session.endSession();
  }
}
