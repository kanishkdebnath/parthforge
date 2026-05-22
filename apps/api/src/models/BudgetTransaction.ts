import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetTransactionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String },
    recurringTemplateId: {
      type: Types.ObjectId,
      ref: 'BudgetRecurringTemplate',
    },
  },
  { timestamps: true }
);

budgetTransactionSchema.index({ userId: 1, date: -1 });
budgetTransactionSchema.index({ userId: 1, categoryId: 1, date: -1 });

export type BudgetTransactionDoc = InferSchemaType<
  typeof budgetTransactionSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetTransactionModel = model(
  'BudgetTransaction',
  budgetTransactionSchema
);
