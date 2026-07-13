import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

/**
 * Money owed to someone else.
 *
 * Only `name` is required. The owner knows a different subset of the facts for
 * each of their debts — the rate for one, only the instalment and term for
 * another, barely anything for a third — and a form that demanded everything
 * would simply not get filled in. Where a figure is missing, the app declines to
 * compute rather than inventing one (see src/lib/debt-math.ts).
 *
 * The outstanding balance is NOT a field here. It's replayed from the payments
 * on every read — interest accrues with the calendar, not with a write, so a
 * stored figure would need a monthly cron to stay true and would drift the
 * moment a past payment was edited. Ratified 2026-07-13.
 */
export interface IDebt extends Document {
  // Explicit: a function whose return type is annotated `IDebt` (rather than
  // letting Mongoose's HydratedDocument infer) otherwise loses the `id` string
  // virtual. Same reason ITransaction declares it.
  id: string;
  userId: Types.ObjectId;
  name: string;
  creditor?: string;
  /** Original amount borrowed. Integer minor units (Principle 9). */
  principal?: number;
  /** NOT money: a decimal fraction. 0.015 = 1.5% a month. */
  monthlyRate?: number;
  installmentAmount?: number;
  installmentCount?: number;
  /** Free text, so the user has it to hand when they go to pay. Never parsed. */
  accountNumber?: string;
  startDate?: Date;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDebtModel extends Model<IDebt> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<IDebt>
  ): Query<IDebt[], IDebt>;
}

const debtSchema = new Schema<IDebt, IDebtModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    creditor: { type: String, trim: true },
    principal: { type: Number, min: 0 },
    monthlyRate: { type: Number, min: 0, max: 1 },
    installmentAmount: { type: Number, min: 0 },
    installmentCount: { type: Number, min: 1 },
    accountNumber: { type: String, trim: true },
    startDate: { type: Date },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

debtSchema.index({ userId: 1, isArchived: 1 });

debtSchema.statics.findForUser = function (
  this: IDebtModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<IDebt> = {}
) {
  return this.find({ ...filter, userId });
};

const Debt =
  (mongoose.models.Debt as IDebtModel) ||
  mongoose.model<IDebt, IDebtModel>("Debt", debtSchema);

export default Debt;
