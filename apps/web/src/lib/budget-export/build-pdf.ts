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
    doc.text(label, x, topY);
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
