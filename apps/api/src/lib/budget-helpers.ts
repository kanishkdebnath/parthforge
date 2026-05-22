import type {
  BudgetCategoryGroup,
  BudgetCategory,
  BudgetTarget,
  BudgetTransaction,
  BudgetRecurringTemplate,
  BudgetReportGroupRow,
  CurrencyCode,
} from '@pathforge/shared';
import type { BudgetCategoryGroupDoc } from '../models/BudgetCategoryGroup.js';
import type { BudgetCategoryDoc } from '../models/BudgetCategory.js';
import type { BudgetTargetDoc } from '../models/BudgetTarget.js';
import type { BudgetTransactionDoc } from '../models/BudgetTransaction.js';
import type { BudgetRecurringTemplateDoc } from '../models/BudgetRecurringTemplate.js';

// ---- Month derivation ----

/**
 * Returns a `YYYY-MM` string for the given Date in UTC. Months in this app
 * are user-anchored only at display time; storage uses UTC-derived months
 * to keep aggregation deterministic. The frontend converts at the edge if
 * a future iteration needs user-local month bucketing.
 */
export function toIsoMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the first millisecond of the given UTC month and the first
 * millisecond of the next UTC month, suitable for `$gte`/`$lt` queries
 * on `budgetTransactions.date`.
 */
export function monthRangeUtc(month: string): { start: Date; endExclusive: Date } {
  const parts = month.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, endExclusive };
}

// ---- Serializers ----

export function serializeBudgetGroup(
  doc: BudgetCategoryGroupDoc
): BudgetCategoryGroup {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    name: doc.name,
    color: doc.color,
    order: doc.order ?? 0,
    archived: doc.archived ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetCategory(
  doc: BudgetCategoryDoc
): BudgetCategory {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    groupId: String(doc.groupId),
    name: doc.name,
    kind: doc.kind as BudgetCategory['kind'],
    color: doc.color ?? undefined,
    order: doc.order ?? 0,
    archived: doc.archived ?? false,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetTarget(doc: BudgetTargetDoc): BudgetTarget {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    categoryId: String(doc.categoryId),
    month: doc.month,
    amount: doc.amount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetTransaction(
  doc: BudgetTransactionDoc
): BudgetTransaction {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    date: doc.date,
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    description: doc.description ?? undefined,
    recurringTemplateId: doc.recurringTemplateId
      ? String(doc.recurringTemplateId)
      : undefined,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function serializeBudgetRecurring(
  doc: BudgetRecurringTemplateDoc
): BudgetRecurringTemplate {
  return {
    _id: String(doc._id),
    userId: String(doc.userId),
    label: doc.label,
    categoryId: String(doc.categoryId),
    amount: doc.amount,
    cadence: 'monthly',
    dayOfMonth: doc.dayOfMonth,
    lastRunMonth: doc.lastRunMonth ?? undefined,
    active: doc.active ?? true,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// ---- Default seed payloads ----

/**
 * Pure data — the routes layer calls this and persists the docs. Keeping
 * the seed shape next to the serializers lets the unit tests assert on it
 * without booting the DB.
 */
export function defaultGroupsSeed(): Array<{
  name: string;
  color: string;
  order: number;
}> {
  return [
    { name: 'Income', color: '#10b981', order: 0 },   // emerald-500
    { name: 'Bills', color: '#ef4444', order: 1 },    // red-500
    { name: 'Household', color: '#f59e0b', order: 2 }, // amber-500
    { name: 'Debt', color: '#dc2626', order: 3 },     // red-600
    { name: 'Leisure', color: '#8b5cf6', order: 4 },  // violet-500
    { name: 'Savings', color: '#0ea5e9', order: 5 },  // sky-500
    { name: 'Other', color: '#64748b', order: 6 },    // slate-500
  ];
}

/**
 * Per-group seed categories. Names referenced by group `name` since the
 * caller knows the freshly-inserted group ids only after persisting.
 */
export function defaultCategoriesSeed(): Array<{
  groupName: string;
  name: string;
  kind: 'income' | 'expense';
  order: number;
}> {
  return [
    { groupName: 'Income', name: 'Salary', kind: 'income', order: 0 },
    { groupName: 'Bills', name: 'Rent', kind: 'expense', order: 0 },
    { groupName: 'Bills', name: 'Electricity', kind: 'expense', order: 1 },
    { groupName: 'Household', name: 'Groceries', kind: 'expense', order: 0 },
    { groupName: 'Household', name: 'Transport', kind: 'expense', order: 1 },
    { groupName: 'Leisure', name: 'Dining', kind: 'expense', order: 0 },
  ];
}

// ---- Narrative generator ----

/**
 * Generates a one-line narrative summarising the month. Deterministic and
 * template-driven (no LLM in v1). The caller passes in the assembled
 * report rows; this function does not query the DB.
 *
 * Decision: pick the single highest-overshoot expense category and the
 * single biggest-underspend expense category. If no targets exist for the
 * month, surface that explicitly. If no transactions, surface that.
 */
export function generateNarrative(args: {
  month: string;             // "YYYY-MM"
  currency: CurrencyCode;
  expenseActual: number;
  expenseTarget: number;
  hasAnyTarget: boolean;
  hasAnyTransaction: boolean;
  expenseGroups: BudgetReportGroupRow[];
}): string {
  const monthLabel = formatMonth(args.month);
  const cur = args.currency;

  if (!args.hasAnyTransaction) {
    return `In ${monthLabel}, no transactions were logged.`;
  }

  if (!args.hasAnyTarget) {
    return `In ${monthLabel}, you spent ${formatMoney(
      args.expenseActual,
      cur
    )} — no plan was set for this month.`;
  }

  const diff = args.expenseActual - args.expenseTarget;
  const direction = diff <= 0 ? 'under' : 'over';
  const pct =
    args.expenseTarget > 0
      ? Math.round((Math.abs(diff) / args.expenseTarget) * 100)
      : 0;

  const expenseRows = args.expenseGroups
    .flatMap((g) => g.categories.map((c) => ({ ...c, groupName: g.name })))
    .filter((r) => r.target > 0 || r.actual > 0);

  const overshoot = expenseRows
    .filter((r) => r.actual > r.target)
    .sort((a, b) => b.actual - b.target - (a.actual - a.target))[0];

  const underspend = expenseRows
    .filter((r) => r.target > r.actual && r.target > 0)
    .sort((a, b) => b.target - b.actual - (a.target - a.actual))[0];

  const parts: string[] = [];
  parts.push(
    `In ${monthLabel}, you spent ${formatMoney(
      args.expenseActual,
      cur
    )} against a planned ${formatMoney(args.expenseTarget, cur)} — ${direction} by ${formatMoney(
      Math.abs(diff),
      cur
    )} (${pct}%).`
  );
  if (overshoot) {
    parts.push(
      `Biggest overage: ${overshoot.name} (${formatMoney(
        overshoot.actual,
        cur
      )} vs ${formatMoney(overshoot.target, cur)}).`
    );
  }
  if (underspend) {
    parts.push(
      `Biggest underspend: ${underspend.name} (${formatMoney(
        underspend.actual,
        cur
      )} vs ${formatMoney(underspend.target, cur)}).`
    );
  }
  return parts.join(' ');
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonth(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Formats integer minor units back to a display string for the narrative.
 * Uses the currency symbol where well-known; falls back to the ISO code.
 * The web UI does its own formatting — this is only for narrative strings.
 */
function formatMoney(minor: number, currency: CurrencyCode): string {
  const major = Math.round(minor / 100);
  const locale = currency === 'INR' ? 'en-IN' : 'en-US';
  const formatted = major.toLocaleString(locale);
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  return `${symbol}${formatted}`;
}

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
};

// ---- Used by report endpoint: roll up transactions + targets into rows ----

export function buildReportRows(args: {
  groups: BudgetCategoryGroupDoc[];
  categories: BudgetCategoryDoc[];
  transactions: BudgetTransactionDoc[];
  targets: BudgetTargetDoc[];
}): BudgetReportGroupRow[] {
  const categoriesByGroup = new Map<string, BudgetCategoryDoc[]>();
  for (const c of args.categories) {
    const key = String(c.groupId);
    if (!categoriesByGroup.has(key)) categoriesByGroup.set(key, []);
    categoriesByGroup.get(key)!.push(c);
  }

  const actualByCategory = new Map<string, number>();
  for (const t of args.transactions) {
    const key = String(t.categoryId);
    actualByCategory.set(key, (actualByCategory.get(key) ?? 0) + t.amount);
  }

  const targetByCategory = new Map<string, number>();
  for (const t of args.targets) {
    targetByCategory.set(String(t.categoryId), t.amount);
  }

  const rows: BudgetReportGroupRow[] = [];
  for (const g of args.groups) {
    const cats = (categoriesByGroup.get(String(g._id)) ?? [])
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // A group is income if all its non-archived categories are income.
    // Mixed groups are flagged as 'expense' by convention — rare but
    // harmless. (Spec uses groups as organizational, not type-bearing.)
    const liveKinds = new Set(
      cats.filter((c) => !c.archived).map((c) => c.kind)
    );
    const groupKind: 'income' | 'expense' =
      liveKinds.size === 1 && liveKinds.has('income') ? 'income' : 'expense';

    const categoryRows = cats.map((c) => {
      const actual = actualByCategory.get(String(c._id)) ?? 0;
      const target = targetByCategory.get(String(c._id)) ?? 0;
      return {
        categoryId: String(c._id),
        name: c.name,
        actual,
        target,
        delta: actual - target,
      };
    });

    const groupActual = categoryRows.reduce((s, r) => s + r.actual, 0);
    const groupTarget = categoryRows.reduce((s, r) => s + r.target, 0);

    rows.push({
      groupId: String(g._id),
      name: g.name,
      kind: groupKind,
      actual: groupActual,
      target: groupTarget,
      delta: groupActual - groupTarget,
      categories: categoryRows,
    });
  }
  return rows;
}

export function totalsFromRows(rows: BudgetReportGroupRow[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.kind === 'income') income += r.actual;
    else expense += r.actual;
  }
  return { income, expense, net: income - expense };
}

export function targetTotalsFromRows(rows: BudgetReportGroupRow[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const r of rows) {
    if (r.kind === 'income') income += r.target;
    else expense += r.target;
  }
  return { income, expense, net: income - expense };
}
