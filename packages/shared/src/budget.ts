import { z } from 'zod';
import { ObjectIdString } from './objectId.js';

// ---- Primitive schemas ----

/**
 * Common ISO 4217 codes surfaced in the UI's top-of-list. The server accepts
 * any 3-letter uppercase code; this whitelist is just the picker's promoted set.
 */
export const COMMON_CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY',
] as const;

export const CurrencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code');
export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;

/** `YYYY-MM` with a real month. */
export const MonthStringSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
export type MonthString = z.infer<typeof MonthStringSchema>;

/** Positive integer minor units, capped at 10^12 (~₹10 billion). */
export const MoneyAmountSchema = z
  .number()
  .int('Amount must be an integer (minor units)')
  .min(0, 'Amount must be ≥ 0')
  .max(1_000_000_000_000, 'Amount exceeds maximum (10^12 minor units)');
export type MoneyAmount = z.infer<typeof MoneyAmountSchema>;

/** 6-char hex with leading '#'. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a 6-char hex with leading #');
export type HexColor = z.infer<typeof HexColorSchema>;

export const CategoryKindSchema = z.enum(['income', 'expense']);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const CadenceSchema = z.literal('monthly');
export type Cadence = z.infer<typeof CadenceSchema>;

// ---- Domain schemas ----

export const BudgetCategoryGroupSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  name: z.string().min(1).max(80),
  color: HexColorSchema,
  order: z.number().int().min(0),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetCategoryGroup = z.infer<typeof BudgetCategoryGroupSchema>;

export const BudgetCategorySchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  groupId: ObjectIdString,
  name: z.string().min(1).max(80),
  kind: CategoryKindSchema,
  color: HexColorSchema.optional(),
  order: z.number().int().min(0),
  archived: z.boolean().default(false),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetCategory = z.infer<typeof BudgetCategorySchema>;

export const BudgetTargetSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  categoryId: ObjectIdString,
  month: MonthStringSchema,
  amount: MoneyAmountSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetTarget = z.infer<typeof BudgetTargetSchema>;

export const BudgetTransactionSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  date: z.coerce.date(),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  description: z.string().max(500).optional(),
  recurringTemplateId: ObjectIdString.optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetTransaction = z.infer<typeof BudgetTransactionSchema>;

export const BudgetRecurringTemplateSchema = z.object({
  _id: ObjectIdString,
  userId: ObjectIdString,
  label: z.string().min(1).max(120),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  cadence: CadenceSchema,
  dayOfMonth: z.number().int().min(1).max(28),
  lastRunMonth: MonthStringSchema.optional(),
  active: z.boolean().default(true),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type BudgetRecurringTemplate = z.infer<typeof BudgetRecurringTemplateSchema>;

// ---- Request shapes (Create / Update / bulk Reorder / bulk PUT targets) ----

export const CreateBudgetGroupRequestSchema = z.object({
  name: z.string().min(1).max(80),
  color: HexColorSchema,
});
export type CreateBudgetGroupRequest = z.infer<typeof CreateBudgetGroupRequestSchema>;

export const UpdateBudgetGroupRequestSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: HexColorSchema.optional(),
  archived: z.boolean().optional(),
});
export type UpdateBudgetGroupRequest = z.infer<typeof UpdateBudgetGroupRequestSchema>;

export const CreateBudgetCategoryRequestSchema = z.object({
  groupId: ObjectIdString,
  name: z.string().min(1).max(80),
  kind: CategoryKindSchema,
  color: HexColorSchema.optional(),
});
export type CreateBudgetCategoryRequest = z.infer<typeof CreateBudgetCategoryRequestSchema>;

export const UpdateBudgetCategoryRequestSchema = z.object({
  groupId: ObjectIdString.optional(),
  name: z.string().min(1).max(80).optional(),
  kind: CategoryKindSchema.optional(),
  color: HexColorSchema.nullable().optional(),
  archived: z.boolean().optional(),
});
export type UpdateBudgetCategoryRequest = z.infer<typeof UpdateBudgetCategoryRequestSchema>;

// Reorder schema lives in `./reorder.ts` and is exported as
// `ReorderIdsRequestSchema` — the per-feature `BudgetReorderRequestSchema`
// alias was removed when a third caller appeared.

export const CreateBudgetTransactionRequestSchema = z.object({
  date: z.coerce.date(),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  description: z.string().max(500).optional(),
});
export type CreateBudgetTransactionRequest = z.infer<typeof CreateBudgetTransactionRequestSchema>;

export const UpdateBudgetTransactionRequestSchema = z.object({
  date: z.coerce.date().optional(),
  categoryId: ObjectIdString.optional(),
  amount: MoneyAmountSchema.optional(),
  description: z.string().max(500).nullable().optional(),
});
export type UpdateBudgetTransactionRequest = z.infer<typeof UpdateBudgetTransactionRequestSchema>;

export const BulkUpsertTargetsRequestSchema = z.object({
  month: MonthStringSchema,
  items: z
    .array(
      z.object({
        categoryId: ObjectIdString,
        amount: MoneyAmountSchema,
      })
    )
    .max(200),
});
export type BulkUpsertTargetsRequest = z.infer<typeof BulkUpsertTargetsRequestSchema>;

export const CreateBudgetRecurringRequestSchema = z.object({
  label: z.string().min(1).max(120),
  categoryId: ObjectIdString,
  amount: MoneyAmountSchema,
  cadence: CadenceSchema,
  dayOfMonth: z.number().int().min(1).max(28),
  active: z.boolean().optional(),
});
export type CreateBudgetRecurringRequest = z.infer<typeof CreateBudgetRecurringRequestSchema>;

export const UpdateBudgetRecurringRequestSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  categoryId: ObjectIdString.optional(),
  amount: MoneyAmountSchema.optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  active: z.boolean().optional(),
});
export type UpdateBudgetRecurringRequest = z.infer<typeof UpdateBudgetRecurringRequestSchema>;

// ---- Report response shape (server returns this; clients import the type) ----

export const BudgetReportCategoryRowSchema = z.object({
  categoryId: ObjectIdString,
  name: z.string(),
  actual: MoneyAmountSchema,
  target: MoneyAmountSchema,
  delta: z
    .number()
    .int()
    .min(-1_000_000_000_000)
    .max(1_000_000_000_000),
});
export type BudgetReportCategoryRow = z.infer<typeof BudgetReportCategoryRowSchema>;

export const BudgetReportGroupRowSchema = z.object({
  groupId: ObjectIdString,
  name: z.string(),
  kind: CategoryKindSchema,
  actual: MoneyAmountSchema,
  target: MoneyAmountSchema,
  delta: z
    .number()
    .int()
    .min(-1_000_000_000_000)
    .max(1_000_000_000_000),
  categories: z.array(BudgetReportCategoryRowSchema),
});
export type BudgetReportGroupRow = z.infer<typeof BudgetReportGroupRowSchema>;

export const BudgetReportSchema = z.object({
  month: MonthStringSchema,
  currency: CurrencyCodeSchema,
  totals: z.object({
    income: MoneyAmountSchema,
    expense: MoneyAmountSchema,
    net: z.number().int(),
  }),
  targetTotals: z.object({
    income: MoneyAmountSchema,
    expense: MoneyAmountSchema,
    net: z.number().int(),
  }),
  groups: z.array(BudgetReportGroupRowSchema),
  narrative: z.string(),
  recurringDue: z.array(
    z.object({
      templateId: ObjectIdString,
      label: z.string(),
      amount: MoneyAmountSchema,
      dayOfMonth: z.number().int(),
    })
  ),
});
export type BudgetReport = z.infer<typeof BudgetReportSchema>;
