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
