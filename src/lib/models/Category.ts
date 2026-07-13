import mongoose, {
  Schema,
  Types,
  type Document,
  type Model,
  type Query,
  type QueryFilter,
} from "mongoose";

export type CategoryType = "income" | "expense";

export interface ICategory extends Document {
  userId: Types.ObjectId;
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  isDefault: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryModel extends Model<ICategory> {
  findForUser(
    userId: string | Types.ObjectId,
    filter?: QueryFilter<ICategory>
  ): Query<ICategory[], ICategory>;
}

const categorySchema = new Schema<ICategory, ICategoryModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
      immutable: true,
    },
    icon: { type: String },
    color: { type: String },
    isDefault: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ userId: 1, type: 1, isArchived: 1 });
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });

categorySchema.statics.findForUser = function (
  this: ICategoryModel,
  userId: string | Types.ObjectId,
  filter: QueryFilter<ICategory> = {}
) {
  return this.find({ ...filter, userId });
};

const Category =
  (mongoose.models.Category as ICategoryModel) ||
  mongoose.model<ICategory, ICategoryModel>("Category", categorySchema);

export default Category;
