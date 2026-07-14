import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Account, { type IAccount } from "@/lib/models/Account";
import Transaction, {
  type ITransaction,
  type TransactionOrigin,
  type TransactionType,
} from "@/lib/models/Transaction";
import { InsufficientFundsError, NotFoundError } from "@/lib/errors";
import { availableBalance } from "@/lib/balance";

export function signedDelta(type: TransactionType, amount: number): number {
  return type === "income" ? amount : -amount;
}

// Re-exported so existing importers keep working; the rule itself now lives in
// `@/lib/balance`, which the browser can import too (it has no Mongoose).
export { availableBalance };

/**
 * Throws if money is leaving the account and there isn't enough of it.
 *
 * Called with the account as it stands *after* the `$inc` has been applied —
 * running inside `session.withTransaction`, so throwing rolls the `$inc` back.
 * That keeps it to a single round trip instead of read-then-check-then-write,
 * and leaves no window where a concurrent write could slip between the two.
 *
 * This is a RULE, not a warning. `confirmOverdraft` used to let a caller go
 * ahead anyway; it was removed (ratified 2026-07-14). Money does not appear out
 * of nowhere — if you paid with money you didn't have, it came from somewhere,
 * and the caller is made to say where.
 *
 * Only creation goes through here. Editing or deleting a transaction is
 * correcting the record of money that already moved, and is allowed to leave the
 * account overdrawn — see updateTransaction/deleteTransaction.
 *
 * The error carries the balance as it was *before* the attempt, because that's
 * the number worth showing the user.
 */
function assertSufficientFunds(account: IAccount, appliedDelta: number): void {
  if (appliedDelta >= 0) return;

  const available = availableBalance(account);
  if (available >= 0) return;

  throw new InsufficientFundsError(available - appliedDelta, account.currency);
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
  /** Set when this expense is a payment towards a Debt. */
  debtId?: string;
  /** Marks an income that isn't earnings — see TransactionOrigin. */
  origin?: TransactionOrigin;
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
      const fields = input;
      const delta = signedDelta(fields.type, fields.amount);

      const account = await Account.findOneAndUpdate(
        { _id: fields.accountId, userId },
        { $inc: { currentBalance: delta } },
        { session, returnDocument: "after" }
      );
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }
      // Creation is a decision, and this is where it gets stopped. There is no
      // override — the caller must instead say where the money came from.
      assertSufficientFunds(account, delta);

      const [tx] = await Transaction.create(
        [{ ...fields, userId, currency: account.currency }],
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

      const fields = input;

      // A partial PATCH may omit accountId/type/amount — compute the
      // effective values up front so a description-only edit doesn't
      // apply an $inc with `undefined`.
      const effectiveAccountId =
        fields.accountId ?? existing.accountId.toString();
      const effectiveType = fields.type ?? existing.type;
      const effectiveAmount = fields.amount ?? existing.amount;

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

      // Deliberately NO assertSufficientFunds here (ratified 2026-07-14).
      //
      // A transaction that already exists is money that already moved: editing
      // it is correcting the record of a fact, not deciding to spend. Blocking
      // the edit would lock the user inside their own mistake — record 100.000
      // for what was really 250.000, then be refused the correction for "lack of
      // funds", with no way out. The resulting negative balance is surfaced as an
      // overdraft instead: loud, explained, and answerable.

      // currency stays whatever it was set to at creation — immutable at
      // the schema level, and moot in Fase 1 since every account is COP.
      Object.assign(existing, fields);
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
