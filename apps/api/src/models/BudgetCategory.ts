import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetCategorySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    groupId: {
      type: Types.ObjectId,
      ref: 'BudgetCategoryGroup',
      required: true,
    },
    name: { type: String, required: true },
    kind: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    color: { type: String },
    order: { type: Number, required: true, default: 0 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

budgetCategorySchema.index({ userId: 1, groupId: 1, archived: 1, order: 1 });
budgetCategorySchema.index({ userId: 1, name: 1 }, { unique: true });
budgetCategorySchema.index({ userId: 1, archived: 1, kind: 1 });

export type BudgetCategoryDoc = InferSchemaType<
  typeof budgetCategorySchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetCategoryModel = model(
  'BudgetCategory',
  budgetCategorySchema
);
