import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

import type { TransactionType } from "@/lib/models/Transaction";

/**
 * How often a recurring template comes due.
 *
 * `biweekly` is every 14 days (a fixed cadence, not "twice a month") — the owner
 * gets paid every two weeks, and anchoring that to a day-of-month would drift.
 */
export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

/**
 * A template, not money. "Every month, on the 5th, 1.500.000 leaves Bancolombia
 * towards Arriendo." The money is still a `Transaction` — materialised from this
 * — exactly as a debt payment is, so the account balance moves on its own, the
 * expense shows in the history and counts against budgets, with nothing new to
 * write (ratified 2026-07-13).
 *
 * The outstanding-vs-denormalized question doesn't arise here: this holds no
 * running total, only the *next* due date, which is advanced as occurrences
 * materialise.
 */
export interface IRecurringTransaction extends Document {
  id: string;
  userId: Types.ObjectId;
  name: string;
  type: TransactionType;
  /** Integer minor units (Principle 9). Confirming a different amount never touches this. */
  amount: number;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
  frequency: RecurrenceFrequency;
  /**
   * The day-of-month a monthly/yearly template is anchored to (1–31), derived
   * from `startDate`. Clamped to the last day of shorter months at due time, so
   * a 31 stays a 31 and doesn't drift to the 1st (Scenario 8). Irrelevant to
   * weekly/biweekly, which run on a fixed day cadence.
   */
  anchorDay: number;
  startDate: Date;
  /** The next occurrence to materialise. Advanced as occurrences are generated. */
  nextDueDate: Date;
  /**
   * `true` = "it charges itself" (a direct debit): occurrences materialise
   * automatically, because the money moved whether the user looked or not.
   * `false` = "I pay it myself": occurrences are shown as pending and the user
   * confirms them, optionally correcting the amount.
   */
  autoGenerate: boolean;
  /** After this date the template stops coming due (Scenario/US8). Optional. */
  endDate?: Date;
  isPaused: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRecurringTransactionModel
  extends Model<IRecurringTransaction> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<IRecurringTransaction>
  ): Query<IRecurringTransaction[], IRecurringTransaction>;
}

const recurringTransactionSchema = new Schema<
  IRecurringTransaction,
  IRecurringTransactionModel
>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ["income", "expense"], required: true },
    amount: { type: Number, required: true, min: 1 },
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    frequency: {
      type: String,
      enum: ["weekly", "biweekly", "monthly", "yearly"],
      required: true,
    },
    anchorDay: { type: Number, required: true, min: 1, max: 31 },
    startDate: { type: Date, required: true },
    nextDueDate: { type: Date, required: true },
    autoGenerate: { type: Boolean, required: true },
    endDate: { type: Date },
    isPaused: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

recurringTransactionSchema.index({ userId: 1, isArchived: 1 });
// The catch-up sweep looks for live templates that are due: not paused, and
// nextDueDate on or before today.
recurringTransactionSchema.index({ userId: 1, isPaused: 1, nextDueDate: 1 });

recurringTransactionSchema.statics.findForUser = function (
  this: IRecurringTransactionModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<IRecurringTransaction> = {}
) {
  return this.find({ ...filter, userId });
};

const RecurringTransaction =
  (mongoose.models.RecurringTransaction as IRecurringTransactionModel) ||
  mongoose.model<IRecurringTransaction, IRecurringTransactionModel>(
    "RecurringTransaction",
    recurringTransactionSchema
  );

export default RecurringTransaction;
