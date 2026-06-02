# Budget Monthly Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click monthly export to `/budget/report` that produces a styled PDF mirroring the report view and an Excel workbook with three sheets (transactions, targets, recurring) for the selected month — all generated client-side via dynamic-imported libraries so the main bundle stays slim.

**Architecture:** Frontend-only. `BudgetReportPage` fetches all required queries, assembles a normalized `BudgetExportInput` object, and passes it to a new `BudgetExportMenu` component. The menu calls `exportBudgetPdf` / `exportBudgetXlsx` / `exportBudgetBoth` from `lib/budget-export/index.ts`, which dynamic-import the relevant pure builder (`build-pdf.ts` or `build-xlsx.ts`) and trigger a download via a transient `<a download>` element. Builders are pure functions: `(input: BudgetExportInput) → Blob` — no React, no TanStack Query, fully unit-testable.

**Tech Stack:** React 18 + TypeScript, Vite, Vitest (existing); `exceljs` for `.xlsx`; `jspdf` + `jspdf-autotable` for `.pdf` (all newly added, all dynamic-imported only).

**Spec:** [docs/superpowers/specs/2026-05-30-budget-monthly-export-design.md](../specs/2026-05-30-budget-monthly-export-design.md)

---

## Task 1: Install dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add the three runtime deps**

Run from repo root:
```bash
npm install --workspace=@pathforge/web exceljs@^4.4.0 jspdf@^2.5.2 jspdf-autotable@^3.8.4
```

Expected: three new entries appear under `dependencies` in `apps/web/package.json`, and `package-lock.json` updates. No `--save-dev`: these ship to the browser bundle (lazy chunk only).

- [ ] **Step 2: Type-check**

Run:
```bash
npm --workspace=@pathforge/web run build -- --mode development 2>&1 | tail -5
```

`exceljs` and `jspdf` ship their own TypeScript types; `jspdf-autotable` augments the `jsPDF` prototype with `autoTable` and types via module declaration. Expected: build succeeds (or fails for unrelated reasons; deps themselves should not produce type errors). If `jspdf-autotable` types are missing, install `@types/jspdf-autotable` — but as of v3.8 the types are bundled.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): add exceljs and jspdf for budget export"
```

---

## Task 2: Define the BudgetExportInput type

**Files:**
- Create: `apps/web/src/lib/budget-export/types.ts`

This is the contract between the page (data assembler) and the builders (pure functions). Defining it first means every later task references one canonical shape.

- [ ] **Step 1: Create the type file**

```ts
// apps/web/src/lib/budget-export/types.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/budget-export/types.ts
git commit -m "feat(web): add BudgetExportInput type for budget export pipeline"
```

---

## Task 3: Format helpers for builders

**Files:**
- Create: `apps/web/src/lib/budget-export/format.ts`
- Test: `apps/web/src/lib/budget-export/__tests__/format.test.ts`

Excel needs raw numbers + a format string per currency; PDF reuses the existing `formatMoney` from `budget-formatting.ts` but needs a signed variant for the delta column.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/src/lib/budget-export/__tests__/format.test.ts
import { describe, expect, it } from 'vitest';
import { excelCurrencyFormat, formatSignedMoney, minorToMajor } from '../format';

describe('minorToMajor', () => {
  it('divides minor units by 100', () => {
    expect(minorToMajor(50000)).toBe(500);
    expect(minorToMajor(12345)).toBe(123.45);
    expect(minorToMajor(0)).toBe(0);
  });
});

describe('excelCurrencyFormat', () => {
  it('returns an INR format with two decimals and red negative', () => {
    expect(excelCurrencyFormat('INR')).toBe('"₹"#,##0.00;[Red]-"₹"#,##0.00');
  });
  it('returns a JPY format with no decimals', () => {
    expect(excelCurrencyFormat('JPY')).toBe('"¥"#,##0;[Red]-"¥"#,##0');
  });
  it('falls back to plain number format for unknown codes', () => {
    expect(excelCurrencyFormat('XYZ')).toBe('#,##0.00;[Red]-#,##0.00');
  });
});

describe('formatSignedMoney', () => {
  it('prefixes positive with +, negative with U+2212 minus, zero with neither', () => {
    expect(formatSignedMoney(50000, 'INR')).toBe('+₹500');
    expect(formatSignedMoney(-50000, 'INR')).toBe('−₹500');
    expect(formatSignedMoney(0, 'INR')).toBe('₹0');
  });
  it('handles cents', () => {
    expect(formatSignedMoney(12345, 'USD')).toBe('+$123.45');
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
npm --workspace=@pathforge/web test -- format.test
```

Expected: all three suites fail with `Cannot find module '../format'`.

- [ ] **Step 3: Implement `format.ts`**

```ts
// apps/web/src/lib/budget-export/format.ts
import { formatMoney, getCurrencySymbol } from '../budget-formatting';

/** Minor units (1/100 of the major unit) → major unit number. JPY uses the same /100 convention; display rules differ but storage doesn't. */
export function minorToMajor(minor: number): number {
  return minor / 100;
}

/**
 * Excel cell number-format string for a currency.
 * Two decimals for everything except JPY (zero decimals).
 * Negative numbers in red with a leading hyphen.
 */
export function excelCurrencyFormat(currency: string): string {
  const symbol = getCurrencySymbol(currency).trim();
  const decimals = currency === 'JPY' ? '' : '.00';
  // If the currency code has no known symbol (getCurrencySymbol returns "XYZ " for unknown),
  // produce a plain numeric format without the code in quotes.
  const known = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY'].includes(currency);
  if (!known) {
    return `#,##0${decimals};[Red]-#,##0${decimals}`;
  }
  return `"${symbol}"#,##0${decimals};[Red]-"${symbol}"#,##0${decimals}`;
}

/**
 * Signed display string for the PDF delta column.
 * +/−/none prefix, followed by `formatMoney` of the absolute value.
 * Uses U+2212 MINUS SIGN for negatives (not ASCII hyphen) to match the spec.
 */
export function formatSignedMoney(minor: number, currency: string): string {
  if (minor === 0) return formatMoney(0, currency);
  const sign = minor > 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(minor), currency)}`;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
npm --workspace=@pathforge/web test -- format.test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/format.ts apps/web/src/lib/budget-export/__tests__/format.test.ts
git commit -m "feat(web): currency format helpers for budget export builders"
```

---

## Task 4: Build the Excel workbook builder (TDD)

**Files:**
- Create: `apps/web/src/lib/budget-export/build-xlsx.ts`
- Test: `apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts`

`exceljs` works in Node out of the box. The builder is a pure function: `(input) → Promise<ArrayBuffer>` (exceljs writes asynchronously).

### Step 4a: Fixture helper

- [ ] **Step 1: Add a shared fixture builder for the builder tests**

Create `apps/web/src/lib/budget-export/__tests__/fixtures.ts`:

```ts
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
```

- [ ] **Step 2: Commit the fixture**

```bash
git add apps/web/src/lib/budget-export/__tests__/fixtures.ts
git commit -m "test(web): add shared fixture for budget export builder tests"
```

### Step 4b: Failing test — sheet structure

- [ ] **Step 1: Write the first slice of tests**

Create `apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts`:

```ts
// apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildXlsx } from '../build-xlsx';
import { makeInput } from './fixtures';

async function loadWorkbook(input = makeInput()): Promise<ExcelJS.Workbook> {
  const buf = await buildXlsx(input);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe('buildXlsx — workbook structure', () => {
  it('produces a workbook with three sheets in order', async () => {
    const wb = await loadWorkbook();
    expect(wb.worksheets.map((s) => s.name)).toEqual(['Transactions', 'Targets', 'Recurring']);
  });

  it('sets workbook title and creator', async () => {
    const wb = await loadWorkbook();
    expect(wb.title).toBe('Pathforge Budget — 2026-05');
    expect(wb.creator).toBe('Pathforge');
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: fails with `Cannot find module '../build-xlsx'`.

- [ ] **Step 3: Create minimal `build-xlsx.ts`**

```ts
// apps/web/src/lib/budget-export/build-xlsx.ts
import ExcelJS from 'exceljs';
import type { BudgetExportInput } from './types';
import { excelCurrencyFormat, minorToMajor } from './format';

export async function buildXlsx(input: BudgetExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.title = `Pathforge Budget — ${input.month}`;
  wb.creator = 'Pathforge';

  wb.addWorksheet('Transactions');
  wb.addWorksheet('Targets');
  wb.addWorksheet('Recurring');

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: both tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-xlsx.ts apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
git commit -m "feat(web): scaffold Excel workbook builder for budget export"
```

### Step 4c: Transactions sheet — caption, header, rows, totals

- [ ] **Step 1: Add tests for the Transactions sheet**

Append to `build-xlsx.test.ts`:

```ts
describe('buildXlsx — Transactions sheet', () => {
  it('renders caption on row 1, header on row 2, frozen header', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Transactions')!;
    expect(ws.getCell('A1').value).toBe('Currency: INR');
    expect(ws.getRow(2).values).toEqual([
      undefined, 'Date', 'Group', 'Category', 'Kind', 'Amount', 'Description',
    ]);
    expect(ws.getRow(2).font?.bold).toBe(true);
    expect(ws.views?.[0]?.state).toBe('frozen');
    expect(ws.views?.[0]?.ySplit).toBe(2);
  });

  it('writes one row per transaction starting on row 3, sorted by date asc', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Transactions')!;
    expect(ws.getCell('A3').value).toEqual(new Date('2026-05-01'));
    expect(ws.getCell('B3').value).toBe('Salary');
    expect(ws.getCell('C3').value).toBe('Day job');
    expect(ws.getCell('D3').value).toBe('Income');
    expect(ws.getCell('E3').value).toBe(1000);
    expect(ws.getCell('F3').value).toBe('May payroll');
    expect(ws.getCell('A4').value).toEqual(new Date('2026-05-03'));
    expect(ws.getCell('A5').value).toEqual(new Date('2026-05-10'));
  });

  it('formats Amount column with currency format string', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Transactions')!;
    expect(ws.getCell('E3').numFmt).toBe('"₹"#,##0.00;[Red]-"₹"#,##0.00');
  });

  it('writes a SUMIF-based summary block after the last data row', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Transactions')!;
    // Last data row is row 5 (3 transactions). Summary starts row 7.
    const incomeRow = ws.getRow(7);
    expect(incomeRow.getCell(1).value).toBe('Income total');
    expect(incomeRow.getCell(5).formula).toBe('SUMIF(D3:D5,"Income",E3:E5)');
    expect(incomeRow.getCell(1).font?.bold).toBe(true);

    const expenseRow = ws.getRow(8);
    expect(expenseRow.getCell(1).value).toBe('Expense total');
    expect(expenseRow.getCell(5).formula).toBe('SUMIF(D3:D5,"Expense",E3:E5)');

    const netRow = ws.getRow(9);
    expect(netRow.getCell(1).value).toBe('Net');
    expect(netRow.getCell(5).formula).toBe('E7-E8');
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: the Transactions-sheet block fails; earlier tests still pass.

- [ ] **Step 3: Implement the Transactions sheet**

Replace `buildXlsx` in `build-xlsx.ts`:

```ts
import ExcelJS from 'exceljs';
import type { BudgetExportInput, ExportTransactionRow } from './types';
import { excelCurrencyFormat, minorToMajor } from './format';

const TX_HEADERS = ['Date', 'Group', 'Category', 'Kind', 'Amount', 'Description'] as const;
const TX_WIDTHS = [12, 20, 24, 10, 14, 40];

function capitalize(kind: ExportTransactionRow['kind']): string {
  return kind === 'income' ? 'Income' : 'Expense';
}

function writeCaption(ws: ExcelJS.Worksheet, currency: string): void {
  ws.getCell('A1').value = `Currency: ${currency}`;
  ws.getCell('A1').font = { italic: true, color: { argb: 'FF666666' } };
}

function writeHeader(ws: ExcelJS.Worksheet, headers: readonly string[]): void {
  const row = ws.getRow(2);
  headers.forEach((label, i) => {
    row.getCell(i + 1).value = label;
  });
  row.font = { bold: true };
  row.commit();
  ws.views = [{ state: 'frozen', ySplit: 2 }];
}

function buildTransactionsSheet(ws: ExcelJS.Worksheet, input: BudgetExportInput): void {
  writeCaption(ws, input.currency);
  writeHeader(ws, TX_HEADERS);
  ws.columns = TX_WIDTHS.map((width) => ({ width }));
  const fmt = excelCurrencyFormat(input.currency);
  const sorted = [...input.transactions].sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length === 0) {
    ws.mergeCells('A3:F3');
    const cell = ws.getCell('A3');
    cell.value = 'No transactions in this month.';
    cell.font = { italic: true, color: { argb: 'FF888888' } };
    return;
  }

  sorted.forEach((tx, i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = new Date(`${tx.date}T00:00:00.000Z`);
    r.getCell(1).numFmt = 'yyyy-mm-dd';
    r.getCell(2).value = tx.groupName;
    r.getCell(3).value = tx.categoryName;
    r.getCell(4).value = capitalize(tx.kind);
    r.getCell(5).value = minorToMajor(tx.amount);
    r.getCell(5).numFmt = fmt;
    r.getCell(6).value = tx.description;
  });

  const lastDataRow = 2 + sorted.length;
  const kindRange = `D3:D${lastDataRow}`;
  const amtRange = `E3:E${lastDataRow}`;

  const incomeRow = lastDataRow + 2;
  const expenseRow = lastDataRow + 3;
  const netRow = lastDataRow + 4;

  ws.getCell(`A${incomeRow}`).value = 'Income total';
  ws.getCell(`A${incomeRow}`).font = { bold: true };
  ws.getCell(`E${incomeRow}`).value = { formula: `SUMIF(${kindRange},"Income",${amtRange})` };
  ws.getCell(`E${incomeRow}`).numFmt = fmt;
  ws.getCell(`E${incomeRow}`).font = { bold: true };

  ws.getCell(`A${expenseRow}`).value = 'Expense total';
  ws.getCell(`A${expenseRow}`).font = { bold: true };
  ws.getCell(`E${expenseRow}`).value = { formula: `SUMIF(${kindRange},"Expense",${amtRange})` };
  ws.getCell(`E${expenseRow}`).numFmt = fmt;
  ws.getCell(`E${expenseRow}`).font = { bold: true };

  ws.getCell(`A${netRow}`).value = 'Net';
  ws.getCell(`A${netRow}`).font = { bold: true };
  ws.getCell(`E${netRow}`).value = { formula: `E${incomeRow}-E${expenseRow}` };
  ws.getCell(`E${netRow}`).numFmt = fmt;
  ws.getCell(`E${netRow}`).font = { bold: true };
}

export async function buildXlsx(input: BudgetExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.title = `Pathforge Budget — ${input.month}`;
  wb.creator = 'Pathforge';

  buildTransactionsSheet(wb.addWorksheet('Transactions'), input);
  wb.addWorksheet('Targets');
  wb.addWorksheet('Recurring');

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: all tests pass. (Note: the test asserts cell formulas via `.formula`; exceljs returns formulas under that property for cells set with `{ formula: ... }`.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-xlsx.ts apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
git commit -m "feat(web): render Transactions sheet in budget Excel export"
```

### Step 4d: Empty-month behavior

- [ ] **Step 1: Add the empty-month test**

Append to `build-xlsx.test.ts`:

```ts
describe('buildXlsx — empty month', () => {
  it('shows a caption and omits the summary block when there are no transactions', async () => {
    const wb = await loadWorkbook(makeInput({ transactions: [] }));
    const ws = wb.getWorksheet('Transactions')!;
    expect(ws.getCell('A3').value).toBe('No transactions in this month.');
    // No summary rows
    expect(ws.getCell('A7').value).toBe(null);
  });
});
```

- [ ] **Step 2: Run**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: passes immediately — the empty-case branch was already implemented in step 4c.

- [ ] **Step 3: Commit (no impl change)**

```bash
git add apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
git commit -m "test(web): cover empty-month case for budget Excel export"
```

### Step 4e: Targets sheet

- [ ] **Step 1: Add Targets-sheet tests**

Append to `build-xlsx.test.ts`:

```ts
describe('buildXlsx — Targets sheet', () => {
  it('renders caption, header, and rows sorted by group then category', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Targets')!;
    expect(ws.getCell('A1').value).toBe('Currency: INR');
    expect(ws.getRow(2).values).toEqual([
      undefined, 'Group', 'Category', 'Kind', 'Target', 'Actual', 'Delta',
    ]);
    // Sorted: Food/Eating out, Food/Groceries, Salary/Day job
    expect(ws.getCell('B3').value).toBe('Food');
    expect(ws.getCell('C3').value).toBe('Eating out');
    expect(ws.getCell('B4').value).toBe('Food');
    expect(ws.getCell('C4').value).toBe('Groceries');
    expect(ws.getCell('B5').value).toBe('Salary');
    expect(ws.getCell('C5').value).toBe('Day job');
  });

  it('omits rows where both target and actual are zero', async () => {
    const wb = await loadWorkbook(
      makeInput({
        targets: [
          { groupName: 'Food', categoryName: 'Groceries', kind: 'expense', target: 0, actual: 0, delta: 0 },
          { groupName: 'Salary', categoryName: 'Day job', kind: 'income', target: 1_000_00, actual: 0, delta: -1_000_00 },
        ],
      })
    );
    const ws = wb.getWorksheet('Targets')!;
    expect(ws.getCell('B3').value).toBe('Salary');
    expect(ws.getCell('B4').value).toBe(null); // no second data row
  });

  it('renders two summary rows (income totals, expense totals)', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Targets')!;
    // 3 data rows → rows 3,4,5. Summary at 7,8.
    expect(ws.getCell('A7').value).toBe('Income totals');
    expect(ws.getCell('E7').value).toBe(1200); // 1,200.00
    expect(ws.getCell('F7').value).toBe(1000);
    expect(ws.getCell('G7').value).toBe(-200);
    expect(ws.getCell('A8').value).toBe('Expense totals');
    expect(ws.getCell('E8').value).toBe(700);
    expect(ws.getCell('F8').value).toBe(600);
    expect(ws.getCell('G8').value).toBe(100);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: Targets-sheet block fails (sheet is empty).

- [ ] **Step 3: Implement the Targets sheet**

In `build-xlsx.ts`, add before `buildXlsx`:

```ts
const TARGET_HEADERS = ['Group', 'Category', 'Kind', 'Target', 'Actual', 'Delta'] as const;
const TARGET_WIDTHS = [20, 24, 10, 14, 14, 14];

function buildTargetsSheet(ws: ExcelJS.Worksheet, input: BudgetExportInput): void {
  writeCaption(ws, input.currency);
  writeHeader(ws, TARGET_HEADERS);
  ws.columns = TARGET_WIDTHS.map((width) => ({ width }));
  const fmt = excelCurrencyFormat(input.currency);
  const rows = input.targets
    .filter((t) => !(t.target === 0 && t.actual === 0))
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.categoryName.localeCompare(b.categoryName));

  rows.forEach((t, i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = t.groupName;
    r.getCell(2).value = t.categoryName;
    r.getCell(3).value = capitalize(t.kind);
    r.getCell(4).value = minorToMajor(t.target);
    r.getCell(4).numFmt = fmt;
    r.getCell(5).value = minorToMajor(t.actual);
    r.getCell(5).numFmt = fmt;
    r.getCell(6).value = minorToMajor(t.delta);
    r.getCell(6).numFmt = fmt;
  });

  if (rows.length === 0) return;

  const incomeRows = rows.filter((t) => t.kind === 'income');
  const expenseRows = rows.filter((t) => t.kind === 'expense');
  const summaryStart = 3 + rows.length + 1;

  function writeSummary(rowIdx: number, label: string, subset: typeof rows): void {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = label;
    r.getCell(1).font = { bold: true };
    r.getCell(5).value = minorToMajor(subset.reduce((s, t) => s + t.target, 0));
    r.getCell(5).numFmt = fmt;
    r.getCell(6).value = minorToMajor(subset.reduce((s, t) => s + t.actual, 0));
    r.getCell(6).numFmt = fmt;
    r.getCell(7).value = minorToMajor(subset.reduce((s, t) => s + t.delta, 0));
    r.getCell(7).numFmt = fmt;
    r.font = { bold: true };
  }

  writeSummary(summaryStart, 'Income totals', incomeRows);
  writeSummary(summaryStart + 1, 'Expense totals', expenseRows);
}
```

Replace the line `wb.addWorksheet('Targets');` in `buildXlsx` with:

```ts
  buildTargetsSheet(wb.addWorksheet('Targets'), input);
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-xlsx.ts apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
git commit -m "feat(web): render Targets sheet in budget Excel export"
```

### Step 4f: Recurring sheet

- [ ] **Step 1: Add Recurring-sheet tests**

Append:

```ts
describe('buildXlsx — Recurring sheet', () => {
  it('renders caption, header, and one row per template sorted by day of month', async () => {
    const wb = await loadWorkbook(
      makeInput({
        recurring: [
          { label: 'Internet', dayOfMonth: 15, amount: 999_00, applied: true },
          { label: 'Rent', dayOfMonth: 1, amount: 30_000_00, applied: false },
        ],
      })
    );
    const ws = wb.getWorksheet('Recurring')!;
    expect(ws.getCell('A1').value).toBe('Currency: INR');
    expect(ws.getRow(2).values).toEqual([
      undefined, 'Label', 'Day of Month', 'Amount', 'Applied?',
    ]);
    expect(ws.getCell('A3').value).toBe('Rent');
    expect(ws.getCell('B3').value).toBe(1);
    expect(ws.getCell('C3').value).toBe(30000);
    expect(ws.getCell('D3').value).toBe('No');
    expect(ws.getCell('A4').value).toBe('Internet');
    expect(ws.getCell('D4').value).toBe('Yes');
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

- [ ] **Step 3: Implement the Recurring sheet**

In `build-xlsx.ts`, add:

```ts
const RECURRING_HEADERS = ['Label', 'Day of Month', 'Amount', 'Applied?'] as const;
const RECURRING_WIDTHS = [30, 14, 14, 12];

function buildRecurringSheet(ws: ExcelJS.Worksheet, input: BudgetExportInput): void {
  writeCaption(ws, input.currency);
  writeHeader(ws, RECURRING_HEADERS);
  ws.columns = RECURRING_WIDTHS.map((width) => ({ width }));
  const fmt = excelCurrencyFormat(input.currency);
  const sorted = [...input.recurring].sort((a, b) => a.dayOfMonth - b.dayOfMonth);

  sorted.forEach((tpl, i) => {
    const r = ws.getRow(3 + i);
    r.getCell(1).value = tpl.label;
    r.getCell(2).value = tpl.dayOfMonth;
    r.getCell(3).value = minorToMajor(tpl.amount);
    r.getCell(3).numFmt = fmt;
    r.getCell(4).value = tpl.applied ? 'Yes' : 'No';
  });
}
```

Replace `wb.addWorksheet('Recurring');` with:

```ts
  buildRecurringSheet(wb.addWorksheet('Recurring'), input);
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-xlsx.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-xlsx.ts apps/web/src/lib/budget-export/__tests__/build-xlsx.test.ts
git commit -m "feat(web): render Recurring sheet in budget Excel export"
```

---

## Task 5: Build the PDF builder (TDD)

**Files:**
- Create: `apps/web/src/lib/budget-export/build-pdf.ts`
- Test: `apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts`

PDFs are harder to assert on layout, so tests assert that (a) the function returns a non-empty `Blob` of `application/pdf` MIME, (b) the rendered text stream contains known substrings, and (c) the function does not throw on edge cases (empty narrative, empty groups, empty recurring).

`jspdf` calls `Blob`, `URL.createObjectURL`, and accesses `document` lazily — but the basic `new jsPDF()` + table + `output('blob')` path works in Node. `jspdf-autotable` is imported for its side effect of patching `jsPDF.prototype`.

### Step 5a: Smoke test + structure

- [ ] **Step 1: Add the helper for reading text from a jsPDF output**

The PDF text stream is technically zlib-compressed by default. For test simplicity, configure jspdf to skip compression in the builder, then assert on raw bytes.

Add test file:

```ts
// apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts
import { describe, expect, it } from 'vitest';
import { buildPdf } from '../build-pdf';
import { makeInput } from './fixtures';

async function pdfText(input = makeInput()): Promise<string> {
  const blob = await buildPdf(input);
  const buf = await blob.arrayBuffer();
  // Build PDFs uncompressed (configured in buildPdf), so raw bytes contain readable text.
  return new TextDecoder('latin1').decode(buf);
}

describe('buildPdf — smoke', () => {
  it('returns a non-empty PDF blob', async () => {
    const blob = await buildPdf(makeInput());
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });

  it('contains the month label', async () => {
    const text = await pdfText();
    expect(text).toContain('May 2026');
  });

  it('contains the header brand', async () => {
    const text = await pdfText();
    expect(text).toContain('Pathforge Budget');
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

Expected: module not found.

- [ ] **Step 3: Implement minimal `build-pdf.ts`**

```ts
// apps/web/src/lib/budget-export/build-pdf.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from '../budget-formatting';
import { formatSignedMoney } from './format';
import type { BudgetExportInput } from './types';

function drawPageHeader(doc: jsPDF, monthLabel: string): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pathforge Budget', 40, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(monthLabel, doc.internal.pageSize.getWidth() - 40, 36, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.line(40, 44, doc.internal.pageSize.getWidth() - 40, 44);
}

export async function buildPdf(input: BudgetExportInput): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  drawPageHeader(doc, input.monthLabel);
  return doc.output('blob');
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

Expected: smoke tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-pdf.ts apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts
git commit -m "feat(web): scaffold PDF builder for budget report export"
```

### Step 5b: Summary band + narrative

- [ ] **Step 1: Add tests**

Append:

```ts
describe('buildPdf — summary and narrative', () => {
  it('renders the income/expense/net summary labels', async () => {
    const text = await pdfText();
    expect(text).toContain('Income');
    expect(text).toContain('Expense');
    expect(text).toContain('Net');
  });

  it('renders the narrative text when non-empty', async () => {
    const text = await pdfText();
    expect(text).toContain('Income came in below target.');
  });

  it('skips narrative when empty', async () => {
    const text = await pdfText(makeInput({ report: { ...makeInput().report, narrative: '' } }));
    expect(text).not.toContain('Income came in below target.');
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 3: Implement summary band + narrative**

Replace `buildPdf` body. Full file is now:

```ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatMoney } from '../budget-formatting';
import { formatSignedMoney } from './format';
import type { BudgetExportInput } from './types';

const PAGE_MARGIN = 40;

function drawPageHeader(doc: jsPDF, monthLabel: string): void {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Pathforge Budget', PAGE_MARGIN, 36);
  doc.setFont('helvetica', 'normal');
  doc.text(monthLabel, doc.internal.pageSize.getWidth() - PAGE_MARGIN, 36, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.line(PAGE_MARGIN, 44, doc.internal.pageSize.getWidth() - PAGE_MARGIN, 44);
}

function drawSummaryBand(doc: jsPDF, input: BudgetExportInput, topY: number): number {
  const { totals, targetTotals } = input.report;
  const colWidth = (doc.internal.pageSize.getWidth() - 2 * PAGE_MARGIN) / 3;
  const items: Array<[string, number, number]> = [
    ['Income', totals.income, targetTotals.income],
    ['Expense', totals.expense, targetTotals.expense],
    ['Net', totals.net, targetTotals.net],
  ];

  doc.setFontSize(9);
  doc.setTextColor(120);
  items.forEach(([label, _actual, _target], i) => {
    const x = PAGE_MARGIN + i * colWidth;
    doc.text(label.toUpperCase(), x, topY);
  });

  doc.setFontSize(16);
  items.forEach(([label, actual, target], i) => {
    const x = PAGE_MARGIN + i * colWidth;
    if (label === 'Net') {
      doc.setTextColor(actual >= target ? '#16a34a' : '#dc2626');
    } else {
      doc.setTextColor(20);
    }
    doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(actual, input.currency), x, topY + 22);
  });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140);
  items.forEach(([, , target], i) => {
    const x = PAGE_MARGIN + i * colWidth;
    doc.text(`of ${formatMoney(target, input.currency)}`, x, topY + 36);
  });

  doc.setTextColor(20);
  return topY + 56;
}

function drawNarrative(doc: jsPDF, narrative: string, topY: number): number {
  if (!narrative.trim()) return topY;
  const width = doc.internal.pageSize.getWidth() - 2 * PAGE_MARGIN;
  doc.setFillColor(245);
  const lines = doc.splitTextToSize(narrative, width - 16);
  const lineHeight = 14;
  const boxHeight = lines.length * lineHeight + 16;
  doc.rect(PAGE_MARGIN, topY, width, boxHeight, 'F');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(lines, PAGE_MARGIN + 8, topY + 14);
  return topY + boxHeight + 16;
}

export async function buildPdf(input: BudgetExportInput): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  drawPageHeader(doc, input.monthLabel);
  let y = 64;
  y = drawSummaryBand(doc, input, y);
  y = drawNarrative(doc, input.report.narrative, y);
  return doc.output('blob');
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-pdf.ts apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts
git commit -m "feat(web): render summary band and narrative in budget PDF export"
```

### Step 5c: Group/category tables

- [ ] **Step 1: Add tests**

Append:

```ts
describe('buildPdf — group tables', () => {
  it('renders a heading for each non-empty group', async () => {
    const text = await pdfText();
    expect(text).toContain('Salary');
    expect(text).toContain('Food');
  });

  it('renders category rows with formatted amounts', async () => {
    const text = await pdfText();
    expect(text).toContain('Day job');
    expect(text).toContain('Groceries');
    expect(text).toContain('Eating out');
  });

  it('skips groups where every category has target=0 and actual=0', async () => {
    const input = makeInput();
    input.report.groups.push({
      groupId: '64a000000000000000000003',
      name: 'EmptyGroup',
      kind: 'expense',
      actual: 0,
      target: 0,
      delta: 0,
      categories: [
        { categoryId: '64a000000000000000000030', name: 'Nothing', actual: 0, target: 0, delta: 0 },
      ],
    });
    const text = await pdfText(input);
    expect(text).not.toContain('EmptyGroup');
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 3: Implement group tables**

Add to `build-pdf.ts` (before `buildPdf`):

```ts
function drawGroupTables(doc: jsPDF, input: BudgetExportInput, topY: number): number {
  let cursorY = topY;
  for (const group of input.report.groups) {
    const visible = group.categories.filter((c) => !(c.target === 0 && c.actual === 0));
    if (visible.length === 0) continue;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(group.name, PAGE_MARGIN, cursorY + 14);

    const kindLabel = group.kind === 'income' ? 'INCOME' : 'EXPENSE';
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      kindLabel,
      doc.internal.pageSize.getWidth() - PAGE_MARGIN,
      cursorY + 14,
      { align: 'right' }
    );

    autoTable(doc, {
      startY: cursorY + 22,
      head: [['Category', 'Target', 'Actual', 'Delta']],
      body: [
        ...visible.map((c) => [
          c.name,
          formatMoney(c.target, input.currency),
          formatMoney(c.actual, input.currency),
          formatSignedMoney(c.delta, input.currency),
        ]),
        [
          { content: 'Subtotal', styles: { fontStyle: 'bold' } },
          { content: formatMoney(group.target, input.currency), styles: { fontStyle: 'bold' } },
          { content: formatMoney(group.actual, input.currency), styles: { fontStyle: 'bold' } },
          { content: formatSignedMoney(group.delta, input.currency), styles: { fontStyle: 'bold' } },
        ],
      ],
      headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 80, halign: 'right' },
        2: { cellWidth: 80, halign: 'right' },
        3: { cellWidth: 80, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const raw = String(data.cell.raw ?? '');
          if (raw.startsWith('−')) data.cell.styles.textColor = [220, 38, 38];
        }
      },
      margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
      theme: 'grid',
    });

    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
  }
  return cursorY;
}
```

In `buildPdf`, add after `drawNarrative`:

```ts
  y = drawGroupTables(doc, input, y);
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-pdf.ts apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts
git commit -m "feat(web): render group/category tables in budget PDF export"
```

### Step 5d: Recurring section + footer

- [ ] **Step 1: Add tests**

Append:

```ts
describe('buildPdf — recurring section', () => {
  it('renders the recurring heading and rows', async () => {
    const text = await pdfText();
    expect(text).toContain('Recurring this month');
    expect(text).toContain('Rent');
  });

  it('skips the recurring section entirely when no templates are due', async () => {
    const input = makeInput();
    input.report.recurringDue = [];
    const text = await pdfText(input);
    expect(text).not.toContain('Recurring this month');
  });
});

describe('buildPdf — footer', () => {
  it('renders a page counter on every page', async () => {
    const text = await pdfText();
    expect(text).toMatch(/Page 1 of \d+/);
  });
});
```

- [ ] **Step 2: Run, confirm fails**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 3: Implement recurring + footer**

Add to `build-pdf.ts`:

```ts
function drawRecurring(doc: jsPDF, input: BudgetExportInput, topY: number): number {
  const recurring = input.report.recurringDue;
  if (recurring.length === 0) return topY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text('Recurring this month', PAGE_MARGIN, topY + 14);

  autoTable(doc, {
    startY: topY + 22,
    head: [['Label', 'Day', 'Amount']],
    body: recurring.map((r) => [
      r.label,
      String(r.dayOfMonth),
      formatMoney(r.amount, input.currency),
    ]),
    headStyles: { fillColor: [240, 240, 240], textColor: 30, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 60, halign: 'right' },
      2: { cellWidth: 100, halign: 'right' },
    },
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN },
    theme: 'grid',
  });

  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
}

function drawFooters(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const now = new Date();
  const stamp = `Generated ${now.toISOString().slice(0, 16).replace('T', ' ')}`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(stamp, PAGE_MARGIN, doc.internal.pageSize.getHeight() - 20);
    doc.text(
      `Page ${i} of ${total}`,
      doc.internal.pageSize.getWidth() - PAGE_MARGIN,
      doc.internal.pageSize.getHeight() - 20,
      { align: 'right' }
    );
  }
}
```

In `buildPdf`, replace the end with:

```ts
  y = drawGroupTables(doc, input, y);
  drawRecurring(doc, input, y);
  drawFooters(doc);
  return doc.output('blob');
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm --workspace=@pathforge/web test -- build-pdf.test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/budget-export/build-pdf.ts apps/web/src/lib/budget-export/__tests__/build-pdf.test.ts
git commit -m "feat(web): render recurring section and footers in budget PDF export"
```

---

## Task 6: Download helper

**Files:**
- Create: `apps/web/src/lib/budget-export/download.ts`

Pure DOM glue; no unit test (the function is 6 lines and is exercised by the manual smoke check in Task 9).

- [ ] **Step 1: Create the helper**

```ts
// apps/web/src/lib/budget-export/download.ts
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/budget-export/download.ts
git commit -m "feat(web): browser download helper for budget export"
```

---

## Task 7: Public surface — dynamic-import wrappers

**Files:**
- Create: `apps/web/src/lib/budget-export/index.ts`

This file is the only entry point the rest of the app imports. The builders themselves are loaded lazily via `import()` so the main bundle does not include `exceljs` or `jspdf`.

- [ ] **Step 1: Create the entry point**

```ts
// apps/web/src/lib/budget-export/index.ts
import { triggerDownload } from './download';
import type { BudgetExportInput } from './types';

export type { BudgetExportInput, ExportTransactionRow, ExportTargetRow, ExportRecurringRow } from './types';

export async function exportBudgetXlsx(input: BudgetExportInput): Promise<void> {
  const { buildXlsx } = await import('./build-xlsx');
  const buffer = await buildXlsx(input);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `pathforge-budget-${input.month}-logs.xlsx`);
}

export async function exportBudgetPdf(input: BudgetExportInput): Promise<void> {
  const { buildPdf } = await import('./build-pdf');
  const blob = await buildPdf(input);
  triggerDownload(blob, `pathforge-budget-${input.month}-report.pdf`);
}

export async function exportBudgetBoth(input: BudgetExportInput): Promise<void> {
  const [xlsxMod, pdfMod] = await Promise.all([
    import('./build-xlsx'),
    import('./build-pdf'),
  ]);
  const [buffer, pdfBlob] = await Promise.all([xlsxMod.buildXlsx(input), pdfMod.buildPdf(input)]);
  const xlsxBlob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(pdfBlob, `pathforge-budget-${input.month}-report.pdf`);
  triggerDownload(xlsxBlob, `pathforge-budget-${input.month}-logs.xlsx`);
}
```

- [ ] **Step 2: Type-check**

```bash
npm --workspace=@pathforge/web run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 3: Verify bundle code splitting**

```bash
ls -lh apps/web/dist/assets/*.js | sort -k5 -h
```

Expected: at least two lazy chunks exist whose names include hashed prefixes — one large (~250 KB) containing `exceljs`, another (~150 KB) containing `jspdf`. The main `index-*.js` chunk should NOT contain those modules. Quick sanity check:

```bash
grep -l "ExcelJS" apps/web/dist/assets/*.js | head -5
grep -l "jsPDF" apps/web/dist/assets/*.js | head -5
```

Expected: each grep matches only one or two chunk files, and those files are NOT the main `index-*.js` chunk.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/budget-export/index.ts
git commit -m "feat(web): public surface for budget export with lazy-loaded builders"
```

---

## Task 8: BudgetExportMenu component

**Files:**
- Create: `apps/web/src/components/budget/BudgetExportMenu.tsx`

Uses the existing wrapped `@/components/ui/dropdown-menu` and `@/components/ui/button` (both already in the codebase; verified `button.tsx` and `dropdown-menu.tsx` exist under `apps/web/src/components/ui/`). The component manages its own preparing/done/error state and is told whether the input is ready via a single prop.

- [ ] **Step 1: Create the component**

```tsx
// apps/web/src/components/budget/BudgetExportMenu.tsx
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  exportBudgetPdf,
  exportBudgetXlsx,
  exportBudgetBoth,
  type BudgetExportInput,
} from '@/lib/budget-export';

type State = 'idle' | 'preparing' | 'done';

interface Props {
  input: BudgetExportInput | null;  // null until all queries have resolved
}

export function BudgetExportMenu({ input }: Props) {
  const [state, setState] = useState<State>('idle');
  const ready = input !== null;
  const disabled = !ready || state === 'preparing';

  async function run(action: 'pdf' | 'xlsx' | 'both'): Promise<void> {
    if (!input) return;
    setState('preparing');
    try {
      if (action === 'pdf') await exportBudgetPdf(input);
      else if (action === 'xlsx') await exportBudgetXlsx(input);
      else await exportBudgetBoth(input);
      setState('done');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      console.error('[budget-export]', err);
      toast.error("Couldn't generate export. Try again.");
      setState('idle');
    }
  }

  const label =
    state === 'preparing' ? 'Preparing…' : state === 'done' ? 'Done' : 'Export';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4}>
        <DropdownMenuItem onSelect={() => run('pdf')}>PDF (report)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('xlsx')}>Excel (.xlsx logs)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('both')}>Both</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm --workspace=@pathforge/web run build 2>&1 | tail -10
```

Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/budget/BudgetExportMenu.tsx
git commit -m "feat(web): BudgetExportMenu dropdown for monthly export"
```

---

## Task 9: Wire BudgetReportPage — assemble input and render menu

**Files:**
- Modify: `apps/web/src/pages/BudgetReportPage.tsx`

This is the only place that touches TanStack Query for the export. It joins transactions/targets/groups/categories/recurring/report into a `BudgetExportInput` and passes it to the menu.

- [ ] **Step 1: Replace the page**

Open `apps/web/src/pages/BudgetReportPage.tsx` and replace the contents with:

```tsx
import { useMemo, useState } from 'react';
import { BudgetTabStrip } from '@/components/budget/BudgetTabStrip';
import { BudgetMonthSelector } from '@/components/budget/BudgetMonthSelector';
import { BudgetReportNarrative } from '@/components/budget/BudgetReportNarrative';
import { BudgetReportGroups } from '@/components/budget/BudgetReportGroups';
import { BudgetExportMenu } from '@/components/budget/BudgetExportMenu';
import {
  useBudgetCategories,
  useBudgetGroups,
  useBudgetRecurring,
  useBudgetReport,
  useBudgetTargets,
  useBudgetTransactions,
} from '@/hooks/useBudget';
import { currentIsoMonth } from '@/lib/budget-month';
import type { BudgetExportInput } from '@/lib/budget-export';

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export default function BudgetReportPage() {
  const [month, setMonth] = useState<string>(currentIsoMonth());
  const reportQ = useBudgetReport(month);
  const transactionsQ = useBudgetTransactions(month);
  const targetsQ = useBudgetTargets(month);
  const groupsQ = useBudgetGroups();
  const categoriesQ = useBudgetCategories();
  const recurringQ = useBudgetRecurring();

  const allReady =
    reportQ.isSuccess &&
    transactionsQ.isSuccess &&
    targetsQ.isSuccess &&
    groupsQ.isSuccess &&
    categoriesQ.isSuccess &&
    recurringQ.isSuccess;

  const exportInput: BudgetExportInput | null = useMemo(() => {
    if (!allReady) return null;
    const report = reportQ.data!;
    const groupsById = new Map(groupsQ.data!.map((g) => [g._id, g]));
    const catsById = new Map(categoriesQ.data!.map((c) => [c._id, c]));

    const transactions = transactionsQ.data!.map((tx) => {
      const cat = catsById.get(tx.categoryId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      return {
        date: new Date(tx.date).toISOString().slice(0, 10),
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind: (cat?.kind ?? 'expense') as 'income' | 'expense',
        amount: tx.amount,
        description: tx.description ?? '',
      };
    });

    // Build a lookup: categoryId → { actual, delta } from the report tree
    const reportCatById = new Map<string, { actual: number; delta: number; kind: 'income' | 'expense' }>();
    for (const g of report.groups) {
      for (const c of g.categories) {
        reportCatById.set(c.categoryId, { actual: c.actual, delta: c.delta, kind: g.kind });
      }
    }

    const targets = targetsQ.data!.map((t) => {
      const cat = catsById.get(t.categoryId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      const rc = reportCatById.get(t.categoryId);
      const actual = rc?.actual ?? 0;
      const kind = (rc?.kind ?? cat?.kind ?? 'expense') as 'income' | 'expense';
      return {
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind,
        target: t.amount,
        actual,
        delta: rc?.delta ?? actual - t.amount,
      };
    });

    // Include report-side categories that have actuals but no stored target row (target=0)
    for (const [catId, rc] of reportCatById) {
      if (targetsQ.data!.some((t) => t.categoryId === catId)) continue;
      if (rc.actual === 0) continue;
      const cat = catsById.get(catId);
      const grp = cat ? groupsById.get(cat.groupId) : undefined;
      targets.push({
        groupName: grp?.name ?? '(unknown group)',
        categoryName: cat?.name ?? '(unknown category)',
        kind: rc.kind,
        target: 0,
        actual: rc.actual,
        delta: rc.delta,
      });
    }

    const recurringTemplateIds = new Set(
      transactionsQ.data!
        .map((tx) => tx.recurringTemplateId)
        .filter((id): id is string => Boolean(id))
    );

    const recurring = report.recurringDue.map((r) => ({
      label: r.label,
      dayOfMonth: r.dayOfMonth,
      amount: r.amount,
      applied: recurringTemplateIds.has(r.templateId),
    }));

    return {
      month,
      monthLabel: monthLabel(month),
      currency: report.currency,
      report,
      transactions,
      targets,
      recurring,
    };
  }, [
    allReady,
    month,
    reportQ.data,
    transactionsQ.data,
    targetsQ.data,
    groupsQ.data,
    categoriesQ.data,
    recurringQ.data,
  ]);

  return (
    <main className="container py-10">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Budget</h1>
      <BudgetTabStrip />
      <div className="flex items-center justify-between mb-4">
        <BudgetMonthSelector month={month} onChange={setMonth} />
        <BudgetExportMenu input={exportInput} />
      </div>
      {reportQ.isPending ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : reportQ.isError ? (
        <p className="text-sm text-red-600">Couldn't load report.</p>
      ) : !reportQ.data ? null : (
        <div className="space-y-6">
          <BudgetReportNarrative report={reportQ.data} />
          <BudgetReportGroups report={reportQ.data} />
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 2: Type-check + tests**

```bash
npm --workspace=@pathforge/web run build 2>&1 | tail -10
npm --workspace=@pathforge/web test 2>&1 | tail -20
```

Expected: build succeeds; all tests pass (the format/build-xlsx/build-pdf suites plus the pre-existing budget-expression suite).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/BudgetReportPage.tsx
git commit -m "feat(web): wire BudgetReportPage with export menu and input assembler"
```

---

## Task 10: Manual verification

This is the only place we exercise the full browser flow. It is not optional — the builders' unit tests are good but cannot catch styling regressions, download glitches, or the dynamic-import path.

- [ ] **Step 1: Boot the stack**

From repo root:

```bash
docker compose up -d
```

Wait until `api` logs "listening on :4000" and `web` logs "ready in" (or just `npm --workspace=@pathforge/web run dev` if you'd rather skip the api). Then open http://localhost:5173 and sign in as a dev user.

- [ ] **Step 2: Verify the trigger UI**

Navigate to `/budget/report`. Expected: an `Export` button appears to the right of the month selector. It is disabled briefly during the initial load, then enabled.

- [ ] **Step 3: Click Export → PDF (report)**

Expected:
- Menu opens; "PDF (report)" highlighted on hover.
- Click closes the menu, button shows "Preparing…", then "Done", then "Export".
- File `pathforge-budget-2026-05-report.pdf` (matching the selected month) downloads.
- Open the PDF: header reads "Pathforge Budget" with the month label on the right; summary band shows Income/Expense/Net; narrative block matches what's on screen; one table per non-empty group; recurring table at the bottom if any are due; footer has page count and a generated timestamp.

- [ ] **Step 4: Click Export → Excel (.xlsx logs)**

Expected:
- `pathforge-budget-2026-05-logs.xlsx` downloads.
- Open in Numbers or Excel: three tabs (Transactions, Targets, Recurring) in that order; row 1 has "Currency: …", row 2 has bold frozen headers; Amount columns show the currency symbol; Transactions sheet has working SUMIF totals two rows below the last data row; Targets sheet has Income totals + Expense totals; Recurring lists templates sorted by day with Yes/No applied column.

- [ ] **Step 5: Click Export → Both**

Expected: both files download back-to-back. No console errors. Network panel shows two lazy chunks loaded (one with `ExcelJS` in its source, one with `jsPDF`).

- [ ] **Step 6: Test the empty-month edge case**

Use the month selector to pick a future month with no data. Click Export → Excel. Open it: Transactions sheet shows "No transactions in this month." merged across row 3; Targets/Recurring tabs are present (likely empty or sparse).

- [ ] **Step 7: Bundle inspection (one last time)**

```bash
npm --workspace=@pathforge/web run build
grep -l "ExcelJS" apps/web/dist/assets/*.js
grep -l "jsPDF" apps/web/dist/assets/*.js
grep -L "ExcelJS\|jsPDF" apps/web/dist/assets/index-*.js
```

Expected: `ExcelJS` and `jsPDF` appear only in non-main chunks; the main `index-*.js` chunk is in the third grep's output (i.e. it does NOT contain those library names).

- [ ] **Step 8: Final commit if any tweaks**

If the manual pass surfaced no issues, no commit needed. If anything cosmetic was off (column width, color, spacing), fix in the relevant builder/component and commit with `fix(web): adjust budget export <thing>`.

---

## Out of scope (deferred follow-ups)

- React Testing Library coverage for `BudgetExportMenu` (would require adding `@testing-library/react`, `@testing-library/user-event`, and a jsdom test environment — not worth the setup cost given the builders are pure-tested and the UI is small)
- Multi-month / YTD export
- CSV export
- Scheduled email export
- Server-side generation fallback for low-end devices

---

## Self-review notes

Final check before handoff:

- **Spec coverage:** Every section of the spec (UI surface, BudgetExportInput shape, three Excel sheets with their exact columns + caption + frozen header + formulas + empty-case caption, PDF page header / summary band / narrative / group tables / recurring section / footer, dynamic-import generation, error handling, edge cases, dependency list, testing strategy) maps to a task. The "BudgetExportMenu.test.tsx" component test from the spec is intentionally dropped and called out in **Out of scope** above.
- **Placeholder scan:** No "TBD", "TODO", or "handle edge cases" without showing the code; every step that changes code shows the code.
- **Type consistency:** `BudgetExportInput` defined in Task 2, referenced by name throughout. `buildXlsx` returns `Promise<ArrayBuffer>`; the public surface wraps it into a `Blob` with the correct XLSX MIME. `buildPdf` returns `Promise<Blob>` directly. `BudgetTransaction.description` (optional) is normalized to `""` at the page-level join.
