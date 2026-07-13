import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Account from "@/lib/models/Account";
import Transaction, {
  type ITransaction,
  type TransactionType,
} from "@/lib/models/Transaction";
import { NotFoundError } from "@/lib/errors";

export function signedDelta(type: TransactionType, amount: number): number {
  return type === "income" ? amount : -amount;
}

export interface CreateTransactionServiceInput {
  accountId: string;
  categoryId: string;
  type: TransactionType;
  amount: number;
  date: Date;
  description?: string;
  recurringTransactionId?: string;
  savingsGoalId?: string;
}

export interface UpdateTransactionServiceInput {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  amount?: number;
  date?: Date;
  description?: string;
}

/**
 * Own connection entrypoint (not left to the caller) — this service is
 * meant to be called directly by Fase 2's recurring-transactions
 * generator, not just HTTP routes. connectDB() is a cached no-op after
 * the first call, so this costs nothing for route callers.
 */
export async function createTransaction(
  userId: string,
  input: CreateTransactionServiceInput
): Promise<ITransaction> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const account = await Account.findOneAndUpdate(
        { _id: input.accountId, userId },
        { $inc: { currentBalance: signedDelta(input.type, input.amount) } },
        { session, returnDocument: "after" }
      );
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }

      const [tx] = await Transaction.create(
        [{ ...input, userId, currency: account.currency }],
        { session }
      );
      return tx;
    });
  } finally {
    await session.endSession();
  }
}

export async function updateTransaction(
  userId: string,
  id: string,
  input: UpdateTransactionServiceInput
): Promise<ITransaction> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const existing = await Transaction.findOne({
        _id: id,
        userId,
      }).session(session);
      if (!existing) {
        throw new NotFoundError();
      }

      // A partial PATCH may omit accountId/type/amount — compute the
      // effective values up front so a description-only edit doesn't
      // apply an $inc with `undefined`.
      const effectiveAccountId =
        input.accountId ?? existing.accountId.toString();
      const effectiveType = input.type ?? existing.type;
      const effectiveAmount = input.amount ?? existing.amount;

      // Always revert the old delta then apply the effective one, even
      // when nothing balance-relevant changed (net $inc of 0 is a no-op)
      // — one code path, no "did anything change" branch to get wrong.
      const revertedAccount = await Account.findOneAndUpdate(
        { _id: existing.accountId, userId },
        {
          $inc: {
            currentBalance: -signedDelta(existing.type, existing.amount),
          },
        },
        { session }
      );
      if (!revertedAccount) {
        throw new NotFoundError(
          "La cuenta original no existe o no te pertenece"
        );
      }

      const appliedAccount = await Account.findOneAndUpdate(
        { _id: effectiveAccountId, userId },
        {
          $inc: {
            currentBalance: signedDelta(effectiveType, effectiveAmount),
          },
        },
        { session, returnDocument: "after" }
      );
      if (!appliedAccount) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }

      // currency stays whatever it was set to at creation — immutable at
      // the schema level, and moot in Fase 1 since every account is COP.
      Object.assign(existing, input);
      await existing.save({ session });
      return existing;
    });
  } finally {
    await session.endSession();
  }
}

export async function deleteTransaction(
  userId: string,
  id: string
): Promise<void> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const existing = await Transaction.findOneAndDelete(
        { _id: id, userId },
        { session }
      );
      if (!existing) {
        throw new NotFoundError();
      }

      const account = await Account.findOneAndUpdate(
        { _id: existing.accountId, userId },
        {
          $inc: {
            currentBalance: -signedDelta(existing.type, existing.amount),
          },
        },
        { session }
      );
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }
    });
  } finally {
    await session.endSession();
  }
}
