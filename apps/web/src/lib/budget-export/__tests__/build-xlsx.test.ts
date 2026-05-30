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
