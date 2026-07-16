import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

export type TransactionType = "income" | "expense";

/**
 * Marks the movements that aren't really income or spending.
 *
 * - `disbursement`: borrowed money arriving in an account (see Debt).
 * - `adjustment`: money the app didn't know about, reconciled into the balance.
 * - `transfer`: the same money, moved to another of the user's own accounts.
 *
 * They all move an account balance like a salary or a purchase does, and they
 * would all otherwise corrupt every "what did I earn / what did I spend this
 * month" figure the app reports. Paying off a credit card is not spending
 * 800.000 — it's the same 800.000, in a different place.
 */
export type TransactionOrigin = "disbursement" | "adjustment" | "transfer";

export interface ITransaction extends Document {
  // Explicit, since a function whose return type is annotated `ITransaction`
  // (as opposed to letting it infer Mongoose's own HydratedDocument type)
  // otherwise loses the `id` string virtual getter.
  id: string;
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  categoryId: Types.ObjectId;
  type: TransactionType;
  amount: number;
  currency: string;
  date: Date;
  description?: string;
  recurringTransactionId?: Types.ObjectId;
  savingsGoalId?: Types.ObjectId;
  debtId?: Types.ObjectId;
  origin?: TransactionOrigin;
  /** Links the two legs of a transfer — one expense, one income. */
  transferId?: Types.ObjectId;
  /** A deferred card purchase: how many instalments the statement splits it into. */
  installmentCount?: number;
  /**
   * Which occurrence of a recurring template this materialised (`"2026-07-20"`).
   * The key to idempotency: it is NOT `date` (the user can edit a transaction's
   * date afterwards, which would change the key and let a second pass duplicate
   * it). Immutable, and only ever set alongside `recurringTransactionId`.
   */
  recurringOccurrenceKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITransactionModel extends Model<ITransaction> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<ITransaction>
  ): Query<ITransaction[], ITransaction>;
}

const transactionSchema = new Schema<ITransaction, ITransactionModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: { type: Number, required: true, min: 1 },
    // Derived from Account.currency at creation time by the service layer
    // (src/lib/services/transactions.ts), never client-supplied — immutable
    // is a defense-in-depth backstop, not load-bearing since no Zod schema
    // ever exposes this field.
    currency: { type: String, required: true, immutable: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true, maxlength: 200 },
    // Set when this transaction was materialised from a recurring template
    // (Fase 2). Never client-supplied — the recurring service sets it.
    recurringTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
    },
    // The specific occurrence this materialised. Immutable (see the interface):
    // editing the transaction's date must not move the idempotency key.
    recurringOccurrenceKey: { type: String, immutable: true },
    savingsGoalId: { type: Schema.Types.ObjectId, ref: "SavingsGoal" },
    // Set when this expense is a payment towards a Debt. A debt payment is a
    // real transaction — the money genuinely leaves an account — so it moves the
    // balance, shows up in the history and counts against budgets like any other
    // expense. Modelling payments separately would have created a second, silent
    // ledger. Ratified 2026-07-13.
    debtId: { type: Schema.Types.ObjectId, ref: "Debt" },
    // Immutable: what a movement *was* is a fact about the past. A disbursement
    // that could later be relabelled a salary would quietly rewrite both the
    // debt's payment history and the month's income.
    origin: {
      type: String,
      enum: ["disbursement", "adjustment", "transfer"],
      immutable: true,
    },
    transferId: { type: Schema.Types.ObjectId, immutable: true },
    // A deferred purchase still debits the card in full — your credit limit
    // drops by the whole amount the day you buy. What the instalment count
    // changes is only what THIS MONTH'S STATEMENT demands. Modelling it as a
    // separate Debt would count the same money twice (see specs/credit-card.md).
    installmentCount: { type: Number, min: 2 },
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, debtId: 1 });
transactionSchema.index({ userId: 1, transferId: 1 });
transactionSchema.index({ userId: 1, accountId: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
// Idempotency for recurring materialisation (FR-006): a given occurrence of a
// given template can exist at most once. Partial, so it constrains ONLY the
// transactions born from a recurring template — every ordinary transaction has
// no recurringTransactionId and is left entirely unaffected.
transactionSchema.index(
  { userId: 1, recurringTransactionId: 1, recurringOccurrenceKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      recurringTransactionId: { $exists: true },
    },
  }
);

transactionSchema.statics.findForUser = function (
  this: ITransactionModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<ITransaction> = {}
) {
  return this.find({ ...filter, userId });
};

const Transaction =
  (mongoose.models.Transaction as ITransactionModel) ||
  mongoose.model<ITransaction, ITransactionModel>(
    "Transaction",
    transactionSchema
  );

export default Transaction;
