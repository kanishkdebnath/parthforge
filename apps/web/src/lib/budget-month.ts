/** Returns `YYYY-MM` for the given local Date (or current date if omitted). */
export function toIsoMonth(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Returns the current local month as `YYYY-MM`. */
export function currentIsoMonth(): string {
  return toIsoMonth(new Date());
}

/** Adds `delta` calendar months to a `YYYY-MM` string. Returns `YYYY-MM`. */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + delta, 1);
  return toIsoMonth(d);
}

/** Pretty label for display: "May 2026". */
export function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
