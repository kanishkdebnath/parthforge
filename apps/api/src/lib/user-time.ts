/**
 * Returns YYYY-MM-DD for the user's "today" in preference order:
 *   1. user.timezone (validated via Intl.DateTimeFormat)
 *   2. clientToday  (login-body fallback, already validated YYYY-MM-DD)
 *   3. UTC today    (final fallback)
 */
export function userTodayLocal(tz?: string, clientToday?: string): string {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // invalid tz — fall through to clientToday / UTC
    }
  }
  if (clientToday) return clientToday;
  return new Date().toISOString().slice(0, 10);
}

/** Whether a string is a valid IANA timezone name. Cheap, dependency-free. */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
