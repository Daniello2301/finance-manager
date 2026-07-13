import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

export interface IBudget extends Document {
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  periodKey: string;
  periodStart: Date;
  limitAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBudgetModel extends Model<IBudget> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<IBudget>
  ): Query<IBudget[], IBudget>;
}

const budgetSchema = new Schema<IBudget, IBudgetModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    periodKey: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    periodStart: { type: Date, required: true },
    limitAmount: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true },
  },
  { timestamps: true }
);

budgetSchema.index(
  { userId: 1, categoryId: 1, periodKey: 1 },
  { unique: true }
);
budgetSchema.index({ userId: 1, periodKey: 1 });

budgetSchema.statics.findForUser = function (
  this: IBudgetModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<IBudget> = {}
) {
  return this.find({ ...filter, userId });
};

const Budget =
  (mongoose.models.Budget as IBudgetModel) ||
  mongoose.model<IBudget, IBudgetModel>("Budget", budgetSchema);

export default Budget;
