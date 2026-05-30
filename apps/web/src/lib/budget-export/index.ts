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
