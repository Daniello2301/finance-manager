import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

export type AccountType = "bank" | "cash" | "credit_card";

export interface IAccount extends Document {
  userId: Types.ObjectId;
  name: string;
  type: AccountType;
  currency: string;
  initialBalance: number;
  currentBalance: number;
  creditLimit?: number;
  color?: string;
  icon?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAccountModel extends Model<IAccount> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<IAccount>
  ): Query<IAccount[], IAccount>;
}

const accountSchema = new Schema<IAccount, IAccountModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["bank", "cash", "credit_card"],
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "COP",
      immutable: true,
    },
    initialBalance: { type: Number, required: true, default: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    creditLimit: { type: Number },
    color: { type: String },
    icon: { type: String },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, isArchived: 1 });
accountSchema.index({ userId: 1, createdAt: -1 });

accountSchema.statics.findForUser = function (
  this: IAccountModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<IAccount> = {}
) {
  return this.find({ ...filter, userId });
};

const Account =
  (mongoose.models.Account as IAccountModel) ||
  mongoose.model<IAccount, IAccountModel>("Account", accountSchema);

export default Account;
