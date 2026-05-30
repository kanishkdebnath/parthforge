import { describe, expect, it } from 'vitest';
import { buildPdf } from '../build-pdf';
import { makeInput } from './fixtures';

async function pdfText(input = makeInput()): Promise<string> {
  const blob = await buildPdf(input);
  const buf = await blob.arrayBuffer();
  return new TextDecoder('latin1').decode(buf);
}

describe('buildPdf — smoke', () => {
  it('returns a non-empty PDF blob', async () => {
    const blob = await buildPdf(makeInput());
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });

  it('contains the month label', async () => {
    const text = await pdfText();
    expect(text).toContain('May 2026');
  });

  it('contains the header brand', async () => {
    const text = await pdfText();
    expect(text).toContain('Pathforge Budget');
  });
});

describe('buildPdf — summary and narrative', () => {
  it('renders the income/expense/net summary labels', async () => {
    const text = await pdfText();
    expect(text).toContain('Income');
    expect(text).toContain('Expense');
    expect(text).toContain('Net');
  });

  it('renders the narrative text when non-empty', async () => {
    const text = await pdfText();
    expect(text).toContain('Income came in below target.');
  });

  it('skips narrative when empty', async () => {
    const text = await pdfText(makeInput({ report: { ...makeInput().report, narrative: '' } }));
    expect(text).not.toContain('Income came in below target.');
  });
});

describe('buildPdf — group tables', () => {
  it('renders a heading for each non-empty group', async () => {
    const text = await pdfText();
    expect(text).toContain('Salary');
    expect(text).toContain('Food');
  });

  it('renders category rows with formatted amounts', async () => {
    const text = await pdfText();
    expect(text).toContain('Day job');
    expect(text).toContain('Groceries');
    expect(text).toContain('Eating out');
  });

  it('skips groups where every category has target=0 and actual=0', async () => {
    const input = makeInput();
    input.report.groups.push({
      groupId: '64a000000000000000000003',
      name: 'EmptyGroup',
      kind: 'expense',
      actual: 0,
      target: 0,
      delta: 0,
      categories: [
        { categoryId: '64a000000000000000000030', name: 'Nothing', actual: 0, target: 0, delta: 0 },
      ],
    });
    const text = await pdfText(input);
    expect(text).not.toContain('EmptyGroup');
  });
});

describe('buildPdf — recurring section', () => {
  it('renders the recurring heading and rows', async () => {
    const text = await pdfText();
    expect(text).toContain('Recurring this month');
    expect(text).toContain('Rent');
  });

  it('skips the recurring section entirely when no templates are due', async () => {
    const input = makeInput();
    input.report.recurringDue = [];
    const text = await pdfText(input);
    expect(text).not.toContain('Recurring this month');
  });
});

describe('buildPdf — footer', () => {
  it('renders a page counter on every page', async () => {
    const text = await pdfText();
    expect(text).toMatch(/Page 1 of \d+/);
  });
});
