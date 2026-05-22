import { Schema, model, type InferSchemaType, Types } from 'mongoose';

const budgetRecurringTemplateSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: 'User', required: true },
    label: { type: String, required: true },
    categoryId: {
      type: Types.ObjectId,
      ref: 'BudgetCategory',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    cadence: {
      type: String,
      enum: ['monthly'],
      required: true,
      default: 'monthly',
    },
    dayOfMonth: {
      type: Number,
      required: true,
      min: 1,
      max: 28,
    },
    lastRunMonth: {
      type: String,
      match: /^\d{4}-(0[1-9]|1[0-2])$/,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

budgetRecurringTemplateSchema.index({ userId: 1, active: 1 });

export type BudgetRecurringTemplateDoc = InferSchemaType<
  typeof budgetRecurringTemplateSchema
> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const BudgetRecurringTemplateModel = model(
  'BudgetRecurringTemplate',
  budgetRecurringTemplateSchema
);
