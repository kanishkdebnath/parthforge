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
