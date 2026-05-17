/**
 * Editorial Manuscript date format: lowercase, abbreviated, no year if it's
 * the current year. e.g. "due dec 31", "due dec 2027".
 */
export function formatDeadline(date: Date | string | undefined): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const month = d.toLocaleString('en-US', { month: 'short' }).toLowerCase();
  const day = d.getDate();
  const year = d.getFullYear();
  if (year === now.getFullYear()) return `${month} ${day}`;
  return `${month} ${year}`;
}

export function isOverdue(date: Date | string | undefined, completed: boolean): boolean {
  if (!date || completed) return false;
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getTime() < Date.now();
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return n === 1 ? singular : plural ?? `${singular}s`;
}
