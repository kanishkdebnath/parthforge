import { jsPDF } from 'jspdf';
import _autoTable, { type CellHookData } from 'jspdf-autotable';
import { formatMoney } from '../budget-formatting';
import { formatSignedMoney } from './format';
import type { BudgetExportInput } from './types';

// jspdf-autotable v3.x can resolve as either a function (ESM) or an object with `default` (CJS interop).
// Cover both so the same code works in Vitest (Node) and the Vite browser bundle.
const autoTable: typeof _autoTable =
  typeof _autoTable === 'function'
    ? _autoTable
    : (_autoTable as unknown as { default: typeof _autoTable }).default;

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
  doc.setFillColor(245, 245, 245);
  const lines = doc.splitTextToSize(narrative, width - 16);
  const lineHeight = 14;
  const boxHeight = lines.length * lineHeight + 16;
  doc.rect(PAGE_MARGIN, topY, width, boxHeight, 'F');
  doc.setFontSize(10);
  doc.setTextColor(40);
  doc.text(lines, PAGE_MARGIN + 8, topY + 14);
  return topY + boxHeight + 16;
}

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
      didParseCell: (data: CellHookData) => {
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

export async function buildPdf(input: BudgetExportInput): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: false });
  drawPageHeader(doc, input.monthLabel);
  let y = 64;
  y = drawSummaryBand(doc, input, y);
  y = drawNarrative(doc, input.report.narrative, y);
  y = drawGroupTables(doc, input, y);
  drawRecurring(doc, input, y);
  drawFooters(doc);
  return doc.output('blob');
}
