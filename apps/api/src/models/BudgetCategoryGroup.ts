import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetCategoryGroupSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    color: { type: String, required: true },
    order: { type: Number, required: true, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetCategoryGroupSchema.index({ userId: 1, archived: 1, order: 1 });
budgetCategoryGroupSchema.index({ userId: 1, name: 1 }, { unique: true });

// InferSchemaType does NOT include timestamps even when `timestamps: true` is
// set, so declare them explicitly so serializers can read them as typed Dates.
export type BudgetCategoryGroupDoc = InferSchemaType<
  typeof budgetCategoryGroupSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetCategoryGroupModel = model(
  'BudgetCategoryGroup',
  budgetCategoryGroupSchema
);
