import { describe, it, expect } from 'vitest';
import {
  toIsoMonth,
  monthRangeUtc,
  generateNarrative,
  defaultGroupsSeed,
  defaultCategoriesSeed,
  buildReportRows,
  totalsFromRows,
  targetTotalsFromRows,
} from '../src/lib/budget-helpers.js';

describe('toIsoMonth', () => {
  it('formats UTC month with zero-padding', () => {
    expect(toIsoMonth(new Date(Date.UTC(2026, 4, 22)))).toBe('2026-05');
    expect(toIsoMonth(new Date(Date.UTC(2026, 0, 1)))).toBe('2026-01');
    expect(toIsoMonth(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12');
  });
});

describe('monthRangeUtc', () => {
  it('returns first-of-month and first-of-next-month', () => {
    const r = monthRangeUtc('2026-05');
    expect(r.start.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(r.endExclusive.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('wraps December to next year January', () => {
    const r = monthRangeUtc('2026-12');
    expect(r.endExclusive.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('defaultGroupsSeed', () => {
  it('returns 7 unique named groups in order 0-6', () => {
    const groups = defaultGroupsSeed();
    expect(groups).toHaveLength(7);
    expect(new Set(groups.map((g) => g.name)).size).toBe(7);
    expect(groups.map((g) => g.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe('defaultCategoriesSeed', () => {
  it('references only groups that defaultGroupsSeed declares', () => {
    const groupNames = new Set(defaultGroupsSeed().map((g) => g.name));
    for (const c of defaultCategoriesSeed()) {
      expect(groupNames.has(c.groupName)).toBe(true);
    }
  });

  it('marks the single income category correctly', () => {
    const cats = defaultCategoriesSeed();
    const incomes = cats.filter((c) => c.kind === 'income');
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.name).toBe('Salary');
  });
});

describe('buildReportRows + totals', () => {
  const groupId = 'g0';
  const incomeGroupId = 'gi';

  const groups = [
    {
      _id: groupId,
      name: 'Bills',
      color: '#ef4444',
      order: 1,
      archived: false,
      userId: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: incomeGroupId,
      name: 'Income',
      color: '#10b981',
      order: 0,
      archived: false,
      userId: 'u',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const categories = [
    {
      _id: 'cRent',
      groupId,
      userId: 'u',
      name: 'Rent',
      kind: 'expense',
      order: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 'cSalary',
      groupId: incomeGroupId,
      userId: 'u',
      name: 'Salary',
      kind: 'income',
      order: 0,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const transactions = [
    {
      _id: 't1',
      userId: 'u',
      categoryId: 'cRent',
      amount: 18_00_000,
      date: new Date('2026-05-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      _id: 't2',
      userId: 'u',
      categoryId: 'cSalary',
      amount: 50_00_000,
      date: new Date('2026-05-01'),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  const targets = [
    {
      _id: 'tg1',
      userId: 'u',
      categoryId: 'cRent',
      month: '2026-05',
      amount: 18_00_000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ] as never;

  it('rolls up actuals and targets per group + per category', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const bills = rows.find((r) => r.groupId === groupId)!;
    expect(bills.actual).toBe(18_00_000);
    expect(bills.target).toBe(18_00_000);
    expect(bills.delta).toBe(0);
    expect(bills.kind).toBe('expense');
    expect(bills.categories[0]?.name).toBe('Rent');
  });

  it('marks groups containing only income categories as kind=income', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const income = rows.find((r) => r.groupId === incomeGroupId)!;
    expect(income.kind).toBe('income');
  });

  it('totalsFromRows separates income and expense', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const totals = totalsFromRows(rows);
    expect(totals.income).toBe(50_00_000);
    expect(totals.expense).toBe(18_00_000);
    expect(totals.net).toBe(32_00_000);
  });

  it('targetTotalsFromRows considers only target amounts', () => {
    const rows = buildReportRows({ groups, categories, transactions, targets });
    const t = targetTotalsFromRows(rows);
    expect(t.income).toBe(0);
    expect(t.expense).toBe(18_00_000);
    expect(t.net).toBe(-18_00_000);
  });
});

describe('generateNarrative', () => {
  it('reports no transactions case', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 0,
      expenseTarget: 0,
      hasAnyTarget: false,
      hasAnyTransaction: false,
      expenseGroups: [],
    });
    expect(n).toContain('no transactions');
    expect(n).toContain('May 2026');
  });

  it('reports no plan case', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 36_80_000,
      expenseTarget: 0,
      hasAnyTarget: false,
      hasAnyTransaction: true,
      expenseGroups: [],
    });
    expect(n).toContain('no plan was set');
    expect(n).toContain('₹36,800');
  });

  it('summarises under-target with biggest overage and underspend', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 36_80_000,
      expenseTarget: 40_00_000,
      hasAnyTarget: true,
      hasAnyTransaction: true,
      expenseGroups: [
        {
          groupId: 'g',
          name: 'Leisure',
          kind: 'expense',
          actual: 6_40_000,
          target: 6_00_000,
          delta: 40_000,
          categories: [
            { categoryId: 'd', name: 'Dining', actual: 3_20_000, target: 2_00_000, delta: 1_20_000 },
            { categoryId: 'g', name: 'Groceries', actual: 6_40_000, target: 8_00_000, delta: -1_60_000 },
          ],
        },
      ],
    });
    expect(n).toContain('under by ₹3,200');
    expect(n).toContain('Biggest overage: Dining');
    expect(n).toContain('Biggest underspend: Groceries');
  });

  it('summarises over-target', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'USD',
      expenseActual: 45_000,
      expenseTarget: 40_000,
      hasAnyTarget: true,
      hasAnyTransaction: true,
      expenseGroups: [],
    });
    expect(n).toContain('over by $50');
  });

  it('picks the largest overage when multiple categories are over-target', () => {
    const n = generateNarrative({
      month: '2026-05',
      currency: 'INR',
      expenseActual: 10_00_000,
      expenseTarget: 5_00_000,
      hasAnyTarget: true,
      hasAnyTransaction: true,
      expenseGroups: [
        {
          groupId: 'g',
          name: 'Mixed',
          kind: 'expense',
          actual: 10_00_000,
          target: 5_00_000,
          delta: 5_00_000,
          categories: [
            // Smaller overshoot: 50 over target
            { categoryId: 'a', name: 'Dining', actual: 2_50_000, target: 2_00_000, delta: 50_000 },
            // Larger overshoot: 4,50,000 over target — should be the one surfaced
            { categoryId: 'b', name: 'Shopping', actual: 7_50_000, target: 3_00_000, delta: 4_50_000 },
          ],
        },
      ],
    });
    expect(n).toContain('Biggest overage: Shopping');
    // Confirm the smaller overshoot was NOT picked
    expect(n).not.toContain('Biggest overage: Dining');
  });
});
