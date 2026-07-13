import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

export type TransactionType = "income" | "expense";

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
  },
  { timestamps: true }
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, debtId: 1 });
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
