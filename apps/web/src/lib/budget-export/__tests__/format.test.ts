import { describe, expect, it } from 'vitest';
import { excelCurrencyFormat, formatSignedMoney, minorToMajor } from '../format';

describe('minorToMajor', () => {
  it('divides minor units by 100', () => {
    expect(minorToMajor(50000)).toBe(500);
    expect(minorToMajor(12345)).toBe(123.45);
    expect(minorToMajor(0)).toBe(0);
  });
});

describe('excelCurrencyFormat', () => {
  it('returns an INR format with two decimals and red negative', () => {
    expect(excelCurrencyFormat('INR')).toBe('"₹"#,##0.00;[Red]-"₹"#,##0.00');
  });
  it('returns a JPY format with no decimals', () => {
    expect(excelCurrencyFormat('JPY')).toBe('"¥"#,##0;[Red]-"¥"#,##0');
  });
  it('falls back to plain number format for unknown codes', () => {
    expect(excelCurrencyFormat('XYZ')).toBe('#,##0.00;[Red]-#,##0.00');
  });
});

describe('formatSignedMoney', () => {
  it('prefixes positive with +, negative with U+2212 minus, zero with neither', () => {
    expect(formatSignedMoney(50000, 'INR')).toBe('+₹500');
    expect(formatSignedMoney(-50000, 'INR')).toBe('−₹500');
    expect(formatSignedMoney(0, 'INR')).toBe('₹0');
  });
  it('handles cents', () => {
    expect(formatSignedMoney(12345, 'USD')).toBe('+$123.45');
  });
});
