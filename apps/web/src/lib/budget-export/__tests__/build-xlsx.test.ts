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

describe('buildXlsx — empty month', () => {
  it('shows a caption and omits the summary block when there are no transactions', async () => {
    const wb = await loadWorkbook(makeInput({ transactions: [] }));
    const ws = wb.getWorksheet('Transactions')!;
    expect(ws.getCell('A3').value).toBe('No transactions in this month.');
    expect(ws.getCell('A7').value).toBe(null);
  });
});

describe('buildXlsx — Targets sheet', () => {
  it('renders caption, header, and rows sorted by group then category', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Targets')!;
    expect(ws.getCell('A1').value).toBe('Currency: INR');
    expect(ws.getRow(2).values).toEqual([
      undefined, undefined, 'Group', 'Category', 'Kind', 'Target', 'Actual', 'Delta',
    ]);
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
    expect(ws.getCell('B4').value).toBe(null);
  });

  it('renders two summary rows (income totals, expense totals)', async () => {
    const wb = await loadWorkbook();
    const ws = wb.getWorksheet('Targets')!;
    expect(ws.getCell('A7').value).toBe('Income totals');
    expect(ws.getCell('E7').value).toBe(1200);
    expect(ws.getCell('F7').value).toBe(1000);
    expect(ws.getCell('G7').value).toBe(-200);
    expect(ws.getCell('A8').value).toBe('Expense totals');
    expect(ws.getCell('E8').value).toBe(700);
    expect(ws.getCell('F8').value).toBe(600);
    expect(ws.getCell('G8').value).toBe(100);
  });
});

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
