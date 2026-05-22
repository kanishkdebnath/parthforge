import { describe, it, expect } from 'vitest';
import {
  MonthStringSchema,
  MoneyAmountSchema,
  HexColorSchema,
  CurrencyCodeSchema,
  CreateBudgetTransactionRequestSchema,
  BulkUpsertTargetsRequestSchema,
  CreateBudgetRecurringRequestSchema,
} from '@pathforge/shared';

describe('MonthStringSchema', () => {
  it('accepts valid months', () => {
    expect(MonthStringSchema.safeParse('2026-05').success).toBe(true);
    expect(MonthStringSchema.safeParse('2026-01').success).toBe(true);
    expect(MonthStringSchema.safeParse('2026-12').success).toBe(true);
  });
  it('rejects month 00 and 13', () => {
    expect(MonthStringSchema.safeParse('2026-00').success).toBe(false);
    expect(MonthStringSchema.safeParse('2026-13').success).toBe(false);
  });
  it('rejects malformed strings', () => {
    expect(MonthStringSchema.safeParse('2026-5').success).toBe(false);
    expect(MonthStringSchema.safeParse('2026/05').success).toBe(false);
    expect(MonthStringSchema.safeParse('May 2026').success).toBe(false);
  });
});

describe('MoneyAmountSchema', () => {
  it('accepts zero and positive integers', () => {
    expect(MoneyAmountSchema.safeParse(0).success).toBe(true);
    expect(MoneyAmountSchema.safeParse(1).success).toBe(true);
    expect(MoneyAmountSchema.safeParse(100_000).success).toBe(true);
  });
  it('rejects negative', () => {
    expect(MoneyAmountSchema.safeParse(-1).success).toBe(false);
  });
  it('rejects non-integers', () => {
    expect(MoneyAmountSchema.safeParse(1.5).success).toBe(false);
  });
  it('rejects values above 10^12', () => {
    expect(MoneyAmountSchema.safeParse(1_000_000_000_001).success).toBe(false);
  });
});

describe('HexColorSchema', () => {
  it('accepts 6-char hex with #', () => {
    expect(HexColorSchema.safeParse('#aabbcc').success).toBe(true);
    expect(HexColorSchema.safeParse('#FFFFFF').success).toBe(true);
  });
  it('rejects without #', () => {
    expect(HexColorSchema.safeParse('aabbcc').success).toBe(false);
  });
  it('rejects 3-char short form', () => {
    expect(HexColorSchema.safeParse('#abc').success).toBe(false);
  });
});

describe('CurrencyCodeSchema', () => {
  it('accepts 3-letter uppercase codes', () => {
    expect(CurrencyCodeSchema.safeParse('INR').success).toBe(true);
    expect(CurrencyCodeSchema.safeParse('USD').success).toBe(true);
  });
  it('rejects lowercase / 2-letter / 4-letter codes', () => {
    expect(CurrencyCodeSchema.safeParse('inr').success).toBe(false);
    expect(CurrencyCodeSchema.safeParse('IN').success).toBe(false);
    expect(CurrencyCodeSchema.safeParse('INRA').success).toBe(false);
  });
});

describe('CreateBudgetTransactionRequestSchema', () => {
  it('accepts a minimal transaction', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 50_000,
      }).success
    ).toBe(true);
  });
  it('rejects negative amount', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: -1,
      }).success
    ).toBe(false);
  });
  it('rejects description > 500 chars', () => {
    expect(
      CreateBudgetTransactionRequestSchema.safeParse({
        date: '2026-05-22T10:00:00Z',
        categoryId: '507f1f77bcf86cd799439011',
        amount: 100,
        description: 'x'.repeat(501),
      }).success
    ).toBe(false);
  });
});

describe('BulkUpsertTargetsRequestSchema', () => {
  it('accepts an empty items array (clear all)', () => {
    expect(
      BulkUpsertTargetsRequestSchema.safeParse({
        month: '2026-05',
        items: [],
      }).success
    ).toBe(true);
  });
  it('rejects more than 200 items', () => {
    const items = Array.from({ length: 201 }, () => ({
      categoryId: '507f1f77bcf86cd799439011',
      amount: 100,
    }));
    expect(
      BulkUpsertTargetsRequestSchema.safeParse({ month: '2026-05', items }).success
    ).toBe(false);
  });
});

describe('CreateBudgetRecurringRequestSchema', () => {
  it('accepts dayOfMonth 1-28', () => {
    for (const d of [1, 15, 28]) {
      expect(
        CreateBudgetRecurringRequestSchema.safeParse({
          label: 'Rent',
          categoryId: '507f1f77bcf86cd799439011',
          amount: 1_800_000,
          cadence: 'monthly',
          dayOfMonth: d,
        }).success
      ).toBe(true);
    }
  });
  it('rejects dayOfMonth 0 or 29+', () => {
    for (const d of [0, 29, 30, 31]) {
      expect(
        CreateBudgetRecurringRequestSchema.safeParse({
          label: 'Rent',
          categoryId: '507f1f77bcf86cd799439011',
          amount: 1_800_000,
          cadence: 'monthly',
          dayOfMonth: d,
        }).success
      ).toBe(false);
    }
  });
});
