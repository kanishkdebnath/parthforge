// apps/web/src/lib/budget-export/__tests__/fixtures.ts
import type { BudgetExportInput } from '../types';

export function makeInput(overrides: Partial<BudgetExportInput> = {}): BudgetExportInput {
  return {
    month: '2026-05',
    monthLabel: 'May 2026',
    currency: 'INR',
    report: {
      month: '2026-05',
      currency: 'INR',
      totals: { income: 1_000_00, expense: 600_00, net: 400_00 },
      targetTotals: { income: 1_200_00, expense: 700_00, net: 500_00 },
      groups: [
        {
          groupId: '64a000000000000000000001',
          name: 'Salary',
          kind: 'income',
          actual: 1_000_00,
          target: 1_200_00,
          delta: -200_00,
          categories: [
            {
              categoryId: '64a000000000000000000010',
              name: 'Day job',
              actual: 1_000_00,
              target: 1_200_00,
              delta: -200_00,
            },
          ],
        },
        {
          groupId: '64a000000000000000000002',
          name: 'Food',
          kind: 'expense',
          actual: 600_00,
          target: 700_00,
          delta: 100_00,
          categories: [
            {
              categoryId: '64a000000000000000000020',
              name: 'Groceries',
              actual: 400_00,
              target: 500_00,
              delta: 100_00,
            },
            {
              categoryId: '64a000000000000000000021',
              name: 'Eating out',
              actual: 200_00,
              target: 200_00,
              delta: 0,
            },
          ],
        },
      ],
      narrative: 'Income came in below target.',
      recurringDue: [
        { templateId: '64a0000000000000000000aa', label: 'Rent', amount: 30_000_00, dayOfMonth: 1 },
      ],
    },
    transactions: [
      { date: '2026-05-01', groupName: 'Salary', categoryName: 'Day job', kind: 'income', amount: 1_000_00, description: 'May payroll' },
      { date: '2026-05-03', groupName: 'Food', categoryName: 'Groceries', kind: 'expense', amount: 400_00, description: '' },
      { date: '2026-05-10', groupName: 'Food', categoryName: 'Eating out', kind: 'expense', amount: 200_00, description: 'birthday dinner' },
    ],
    targets: [
      { groupName: 'Salary', categoryName: 'Day job', kind: 'income', target: 1_200_00, actual: 1_000_00, delta: -200_00 },
      { groupName: 'Food', categoryName: 'Groceries', kind: 'expense', target: 500_00, actual: 400_00, delta: 100_00 },
      { groupName: 'Food', categoryName: 'Eating out', kind: 'expense', target: 200_00, actual: 200_00, delta: 0 },
    ],
    recurring: [
      { label: 'Rent', dayOfMonth: 1, amount: 30_000_00, applied: false },
    ],
    ...overrides,
  };
}
