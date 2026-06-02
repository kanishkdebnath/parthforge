import ExcelJS from 'exceljs';
import type { BudgetExportInput, ExportTransactionRow, ExportTargetRow } from './types';
import { excelCurrencyFormat, minorToMajor } from './format';

const TX_HEADERS = ['Date', 'Group', 'Category', 'Kind', 'Amount', 'Description'] as const;
const TX_WIDTHS = [12, 20, 24, 10, 14, 40];

const TARGET_HEADERS = ['Group', 'Category', 'Kind', 'Target', 'Actual', 'Delta'] as const;
// 7 entries: column A reserved for summary row labels ("Income totals" / "Expense totals"); columns B–G hold the 6 headers.
const TARGET_WIDTHS = [14, 20, 24, 10, 14, 14, 14];

const RECURRING_HEADERS = ['Label', 'Day of Month', 'Amount', 'Applied?'] as const;
const RECURRING_WIDTHS = [30, 14, 14, 12];

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

function buildTargetsSheet(ws: ExcelJS.Worksheet, input: BudgetExportInput): void {
  writeCaption(ws, input.currency);
  ws.columns = TARGET_WIDTHS.map((width) => ({ width }));
  const fmt = excelCurrencyFormat(input.currency);

  // Write headers starting at column B (index 2)
  const headerRow = ws.getRow(2);
  TARGET_HEADERS.forEach((label, i) => {
    headerRow.getCell(i + 2).value = label;
  });
  headerRow.font = { bold: true };
  headerRow.commit();
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  const rows = input.targets
    .filter((t) => !(t.target === 0 && t.actual === 0))
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.categoryName.localeCompare(b.categoryName));

  rows.forEach((t, i) => {
    const r = ws.getRow(3 + i);
    r.getCell(2).value = t.groupName;   // B
    r.getCell(3).value = t.categoryName; // C
    r.getCell(4).value = capitalize(t.kind); // D
    r.getCell(5).value = minorToMajor(t.target); // E
    r.getCell(5).numFmt = fmt;
    r.getCell(6).value = minorToMajor(t.actual); // F
    r.getCell(6).numFmt = fmt;
    r.getCell(7).value = minorToMajor(t.delta); // G
    r.getCell(7).numFmt = fmt;
  });

  if (rows.length === 0) return;

  const incomeRows = rows.filter((t) => t.kind === 'income');
  const expenseRows = rows.filter((t) => t.kind === 'expense');
  const summaryStart = 3 + rows.length + 1;

  function writeSummary(rowIdx: number, label: string, subset: ExportTargetRow[]): void {
    const r = ws.getRow(rowIdx);
    r.getCell(1).value = label;
    r.getCell(5).value = minorToMajor(subset.reduce((s, t) => s + t.target, 0)); // E
    r.getCell(5).numFmt = fmt;
    r.getCell(6).value = minorToMajor(subset.reduce((s, t) => s + t.actual, 0)); // F
    r.getCell(6).numFmt = fmt;
    r.getCell(7).value = minorToMajor(subset.reduce((s, t) => s + t.delta, 0)); // G
    r.getCell(7).numFmt = fmt;
    r.font = { bold: true };
  }

  writeSummary(summaryStart, 'Income totals', incomeRows);
  writeSummary(summaryStart + 1, 'Expense totals', expenseRows);
}

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

export async function buildXlsx(input: BudgetExportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.title = `Pathforge Budget — ${input.month}`;
  wb.creator = 'Pathforge';

  buildTransactionsSheet(wb.addWorksheet('Transactions'), input);
  buildTargetsSheet(wb.addWorksheet('Targets'), input);
  buildRecurringSheet(wb.addWorksheet('Recurring'), input);

  // exceljs returns Buffer in Node, ArrayBuffer in the browser. We always run this in the Vite browser bundle (lazy-imported by the export menu), so the cast is safe.
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
