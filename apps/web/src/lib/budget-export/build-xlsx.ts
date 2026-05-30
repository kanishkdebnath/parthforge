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
