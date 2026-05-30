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
