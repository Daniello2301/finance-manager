import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Account, { type IAccount } from "@/lib/models/Account";
import Transaction, {
  type ITransaction,
  type TransactionType,
} from "@/lib/models/Transaction";
import { InsufficientFundsError, NotFoundError } from "@/lib/errors";

export function signedDelta(type: TransactionType, amount: number): number {
  return type === "income" ? amount : -amount;
}

/**
 * What the account can actually spend.
 *
 * For a credit card the balance runs negative as you use it, so what's spendable
 * is the unused credit — the limit plus the (negative) balance. For bank/cash
 * it's just the balance. Same formula the UI already shows on AccountCard.
 */
export function availableBalance(account: IAccount): number {
  return account.type === "credit_card"
    ? (account.creditLimit ?? 0) + account.currentBalance
    : account.currentBalance;
}

/**
 * Throws if money is leaving the account and there isn't enough of it.
 *
 * Called with the account as it stands *after* the `$inc` has been applied —
 * running inside `session.withTransaction`, so throwing rolls the `$inc` back.
 * That keeps it to a single round trip instead of read-then-check-then-write,
 * and leaves no window where a concurrent write could slip between the two.
 *
 * This is a warning, not a rule: the caller can pass `confirmOverdraft` to go
 * ahead deliberately. The error carries the balance as it was *before* the
 * attempt, because that's the number worth showing the user.
 */
function assertSufficientFunds(
  account: IAccount,
  appliedDelta: number,
  confirmOverdraft: boolean | undefined
): void {
  if (confirmOverdraft || appliedDelta >= 0) return;

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
  confirmOverdraft?: boolean;
  recurringTransactionId?: string;
  savingsGoalId?: string;
  /** Set when this expense is a payment towards a Debt. */
  debtId?: string;
}

export interface UpdateTransactionServiceInput {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  amount?: number;
  date?: Date;
  description?: string;
  confirmOverdraft?: boolean;
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
      // `confirmOverdraft` is a request-level decision, not a property of the
      // transaction — keep it out of the document.
      const { confirmOverdraft, ...fields } = input;
      const delta = signedDelta(fields.type, fields.amount);

      const account = await Account.findOneAndUpdate(
        { _id: fields.accountId, userId },
        { $inc: { currentBalance: delta } },
        { session, returnDocument: "after" }
      );
      if (!account) {
        throw new NotFoundError("La cuenta no existe o no te pertenece");
      }
      assertSufficientFunds(account, delta, confirmOverdraft);

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

      const { confirmOverdraft, ...fields } = input;

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

      // How much this account moved, net. When the edit keeps the same account
      // the returned doc already reflects both the revert and the apply, so the
      // net is the difference; when the transaction is moved to a different
      // account, that account only ever saw the apply.
      const appliedDelta =
        effectiveAccountId === existing.accountId.toString()
          ? signedDelta(effectiveType, effectiveAmount) -
            signedDelta(existing.type, existing.amount)
          : signedDelta(effectiveType, effectiveAmount);
      assertSufficientFunds(appliedAccount, appliedDelta, confirmOverdraft);

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
