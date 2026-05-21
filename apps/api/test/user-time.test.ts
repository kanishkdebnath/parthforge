import { describe, it, expect } from 'vitest';
import { userTodayLocal, isValidTimezone } from '../src/lib/user-time.js';

describe('isValidTimezone', () => {
  it('accepts canonical IANA names', () => {
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('America/Los_Angeles')).toBe(true);
    expect(isValidTimezone('Asia/Kolkata')).toBe(true);
    expect(isValidTimezone('Europe/Berlin')).toBe(true);
  });

  it('rejects garbage strings', () => {
    expect(isValidTimezone('Not/A_Zone')).toBe(false);
    expect(isValidTimezone('Mars/Olympus_Mons')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('userTodayLocal', () => {
  it('returns the tz-local date when tz is valid', () => {
    const out = userTodayLocal('UTC');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Round-trip: UTC today should equal the UTC ISO slice.
    expect(out).toBe(new Date().toISOString().slice(0, 10));
  });

  it('returns a different date for LA vs UTC at the boundary', () => {
    const la = userTodayLocal('America/Los_Angeles');
    expect(la).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The LA day is either equal to UTC day or one earlier.
    const utc = userTodayLocal('UTC');
    expect([utc, prevDay(utc)]).toContain(la);
  });

  it('falls through to clientToday when tz is invalid', () => {
    expect(userTodayLocal('Not/A_Zone', '2026-05-22')).toBe('2026-05-22');
  });

  it('falls through to clientToday when tz is undefined', () => {
    expect(userTodayLocal(undefined, '2026-05-22')).toBe('2026-05-22');
  });

  it('falls through to UTC today when both are absent', () => {
    expect(userTodayLocal()).toBe(new Date().toISOString().slice(0, 10));
  });

  it('falls through to UTC today when tz is invalid and clientToday is absent', () => {
    expect(userTodayLocal('Not/A_Zone')).toBe(
      new Date().toISOString().slice(0, 10)
    );
  });
});

function prevDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
