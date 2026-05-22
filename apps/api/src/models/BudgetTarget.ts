import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetTargetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    amount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// One target per category per month.
budgetTargetSchema.index(
  { userId: 1, month: 1, categoryId: 1 },
  { unique: true }
);
// Per-category target trend across months.
budgetTargetSchema.index({ userId: 1, categoryId: 1, month: -1 });

export type BudgetTargetDoc = InferSchemaType<typeof budgetTargetSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetTargetModel = model('BudgetTarget', budgetTargetSchema);
