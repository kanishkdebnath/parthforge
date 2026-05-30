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
