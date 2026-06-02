import type { BudgetReport } from '@pathforge/shared';

export type ExportKind = 'income' | 'expense';

export interface ExportTransactionRow {
  date: string;          // "YYYY-MM-DD"
  groupName: string;
  categoryName: string;
  kind: ExportKind;
  amount: number;        // minor units
  description: string;   // "" if BudgetTransaction.description is undefined
}

export interface ExportTargetRow {
  groupName: string;
  categoryName: string;
  kind: ExportKind;
  target: number;        // minor units
  actual: number;        // minor units
  delta: number;         // minor units (signed: actual - target for income, target - actual for expense — kept signed as the report computes it)
}

export interface ExportRecurringRow {
  label: string;
  dayOfMonth: number;
  amount: number;        // minor units
  applied: boolean;
}

export interface BudgetExportInput {
  month: string;         // "YYYY-MM"
  monthLabel: string;    // e.g. "May 2026"
  currency: string;      // ISO code, e.g. "INR"
  report: BudgetReport;
  transactions: ExportTransactionRow[];
  targets: ExportTargetRow[];
  recurring: ExportRecurringRow[];
}
