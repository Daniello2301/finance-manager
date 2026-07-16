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
    // Unused in Fase 1 — reserved for Gastos Recurrentes / Metas de Ahorro
    // (Fase 2). No index, not exposed by any Zod schema or route.
    recurringTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "RecurringTransaction",
    },
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
