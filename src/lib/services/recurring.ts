import { connectDB } from "@/lib/db";
import RecurringTransaction, {
  type IRecurringTransaction,
} from "@/lib/models/RecurringTransaction";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { createTransaction } from "@/lib/services/transactions";
import {
  dueOccurrences,
  nextOccurrence,
  occurrenceKey,
} from "@/lib/recurrence";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Materialises one occurrence of a template into a real `Transaction`.
 *
 * Idempotent by design (Scenario 3): the unique partial index on
 * `{userId, recurringTransactionId, recurringOccurrenceKey}` means a second
 * attempt at the same occurrence throws a duplicate-key error, which is caught
 * and treated as "already done". That is what lets the create-first/advance-after
 * order be safe without a distributed transaction — see catchUp.
 *
 * `allowOverdraft` is passed only for automatic generation: a direct debit that
 * already hit the bank is a consummated fact and is recorded even into the red.
 *
 * Returns true if it created the transaction, false if it was already there.
 */
async function materialise(
  recurring: IRecurringTransaction,
  occurrenceDate: Date,
  amount: number,
  allowOverdraft: boolean
): Promise<boolean> {
  try {
    await createTransaction(
      recurring.userId.toString(),
      {
        accountId: recurring.accountId.toString(),
        categoryId: recurring.categoryId.toString(),
        type: recurring.type,
        amount,
        date: occurrenceDate,
        recurringTransactionId: recurring.id,
        recurringOccurrenceKey: occurrenceKey(occurrenceDate),
      },
      { allowOverdraft }
    );
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
}

/**
 * The next due date to carry after materialising or skipping `occurrenceDate`.
 * Stops advancing once past `endDate` is irrelevant here — the caller stores it
 * and `dueOccurrences` simply returns nothing next time.
 */
function advance(recurring: IRecurringTransaction, occurrenceDate: Date): Date {
  return nextOccurrence(occurrenceDate, recurring.frequency, recurring.anchorDay);
}

/**
 * Materialises every overdue occurrence of the user's AUTOMATIC templates.
 *
 * Order is create-first, advance-after (FR-006). If the process died between a
 * successful create and the `nextDueDate` save, the next sweep re-attempts the
 * create, the unique index rejects it, and the advance still happens — it
 * converges without ever double-charging. Runs on every dashboard load.
 */
export async function catchUp(
  userId: string,
  today: Date = new Date()
): Promise<{ created: number }> {
  await connectDB();

  const templates = await RecurringTransaction.find({
    userId,
    autoGenerate: true,
    isPaused: false,
    isArchived: false,
    nextDueDate: { $lte: today },
  });

  let created = 0;
  for (const recurring of templates) {
    const dues = dueOccurrences(recurring, today);
    if (dues.length === 0) continue;

    for (const occurrence of dues) {
      const didCreate = await materialise(
        recurring,
        occurrence,
        recurring.amount,
        true
      );
      if (didCreate) created++;
    }

    recurring.nextDueDate = advance(recurring, dues[dues.length - 1]);
    await recurring.save();
  }

  return { created };
}

export interface PendingConfirmation {
  recurringId: string;
  name: string;
  type: IRecurringTransaction["type"];
  /** The template amount — the user may confirm a different one (FR-007). */
  amount: number;
  accountId: string;
  categoryId: string;
  /** The earliest unconfirmed occurrence — the one that gets acted on next. */
  occurrenceKey: string;
  date: Date;
  /** How many occurrences of this template are overdue in total. */
  overdueCount: number;
}

/**
 * The overdue occurrences of the user's MANUAL templates — shown, never created.
 *
 * One entry per template (the earliest pending one, which is the only one
 * confirm/skip will act on), plus how many are backed up, so the UI can say
 * "2 pendientes" without listing each.
 */
export async function pendingConfirmations(
  userId: string,
  today: Date = new Date()
): Promise<PendingConfirmation[]> {
  await connectDB();

  const templates = await RecurringTransaction.find({
    userId,
    autoGenerate: false,
    isPaused: false,
    isArchived: false,
    nextDueDate: { $lte: today },
  });

  const pending: PendingConfirmation[] = [];
  for (const recurring of templates) {
    const dues = dueOccurrences(recurring, today);
    if (dues.length === 0) continue;

    pending.push({
      recurringId: recurring.id,
      name: recurring.name,
      type: recurring.type,
      amount: recurring.amount,
      accountId: recurring.accountId.toString(),
      categoryId: recurring.categoryId.toString(),
      occurrenceKey: occurrenceKey(dues[0]),
      date: dues[0],
      overdueCount: dues.length,
    });
  }
  return pending;
}

async function loadOwned(
  userId: string,
  id: string
): Promise<IRecurringTransaction> {
  await connectDB();
  const recurring = await RecurringTransaction.findOne({ _id: id, userId });
  if (!recurring) throw new NotFoundError();
  return recurring;
}

/**
 * Guards that `occurrenceKey` is the current pending occurrence.
 *
 * confirm/skip only ever act on the earliest unconfirmed occurrence — the one at
 * `nextDueDate`. Requiring the key to match keeps `nextDueDate` monotonic (no
 * gaps, no going backwards) and makes a double-confirm from two tabs safe: once
 * the first advances the date, the second no longer matches and is refused
 * cleanly instead of materialising a second time.
 */
function assertCurrentOccurrence(
  recurring: IRecurringTransaction,
  key: string,
  today: Date
): void {
  if (recurring.isArchived) {
    throw new ValidationError("Este recurrente está archivado");
  }
  if (key !== occurrenceKey(recurring.nextDueDate)) {
    throw new ValidationError("Ese no es el vencimiento pendiente actual");
  }
  if (occurrenceKey(recurring.nextDueDate) > occurrenceKey(today)) {
    throw new ValidationError("Ese vencimiento aún no llega");
  }
}

/**
 * Confirms one pending occurrence of a MANUAL template, optionally at a corrected
 * amount (FR-007: the correction never changes the template's stored amount).
 *
 * No `allowOverdraft`: confirming a payment you're making now IS a decision, so
 * it goes through the normal funds check and, if it overdraws, surfaces the
 * four-exit dialog like any other expense.
 */
export async function confirmOccurrence(
  userId: string,
  id: string,
  key: string,
  amount?: number,
  today: Date = new Date()
): Promise<IRecurringTransaction> {
  const recurring = await loadOwned(userId, id);
  assertCurrentOccurrence(recurring, key, today);

  await materialise(
    recurring,
    recurring.nextDueDate,
    amount ?? recurring.amount,
    false
  );

  recurring.nextDueDate = advance(recurring, recurring.nextDueDate);
  await recurring.save();
  return recurring;
}

/**
 * Skips one pending occurrence: no transaction, no balance change, the due date
 * just advances (Scenario 6 / US4).
 */
export async function skipOccurrence(
  userId: string,
  id: string,
  key: string,
  today: Date = new Date()
): Promise<IRecurringTransaction> {
  const recurring = await loadOwned(userId, id);
  assertCurrentOccurrence(recurring, key, today);

  recurring.nextDueDate = advance(recurring, recurring.nextDueDate);
  await recurring.save();
  return recurring;
}
