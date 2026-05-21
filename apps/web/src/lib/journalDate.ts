/** YYYY-MM-DD for the user's current local day. */
export function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM for the month containing the given YYYY-MM-DD. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** First day of the month containing the given YYYY-MM-DD. */
export function firstOfMonth(date: string): string {
  return `${monthOf(date)}-01`;
}

/** Last day of the month containing the given YYYY-MM-DD. */
export function lastOfMonth(date: string): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${monthOf(date)}-${String(last).padStart(2, '0')}`;
}

/** Add N months to a YYYY-MM (clamps day to 1). */
export function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

/** Human label for a YYYY-MM ("May 2026"). */
export function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Human label for a YYYY-MM-DD ("Thu, May 14, 2026"). */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Day of week (0 = Sun … 6 = Sat) for a YYYY-MM-DD. */
export function dayOfWeek(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Build the list of YYYY-MM-DD strings filling out a month grid (Sun–Sat),
 *  including leading/trailing nulls for cells outside the month. */
export function monthGridCells(yyyyMm: string): Array<string | null> {
  const first = `${yyyyMm}-01`;
  const last = lastOfMonth(first);
  const [, , lastDay] = last.split('-').map(Number) as [number, number, number];
  const leading = dayOfWeek(first);
  const cells: Array<string | null> = Array(leading).fill(null);
  for (let i = 1; i <= lastDay; i++) {
    cells.push(`${yyyyMm}-${String(i).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
