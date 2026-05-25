/**
 * Currency-symbol lookup for the codes the picker promotes (matches the
 * server-side CURRENCY_SYMBOL in apps/api/src/lib/budget-helpers.ts).
 */
const CURRENCY_SYMBOL: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  SGD: 'S$',
  JPY: '¥',
};

/** Returns the localized digit grouping for a currency. INR uses lakhs/crores; others use western grouping. */
function localeFor(currency: string): string {
  return currency === 'INR' ? 'en-IN' : 'en-US';
}

/**
 * Formats an integer in minor units to a display string with currency symbol.
 * e.g. (50000, 'INR') → "₹500"      (5000_00, 'INR') → "₹5,00,000"
 *      (12345, 'INR') → "₹123.45"   (100000_00, 'USD') → "$100,000"
 *
 * Uses Intl.NumberFormat so digit grouping and decimal display are locale-correct.
 * Subunits (cents/paise) are shown only when non-zero — "₹500" stays clean,
 * "₹500.45" surfaces the cents. JPY has no subunit and is special-cased.
 */
export function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  const symbol = CURRENCY_SYMBOL[currency] ?? `${currency} `;
  const isSubunitless = currency === 'JPY';
  const formatted = new Intl.NumberFormat(localeFor(currency), {
    minimumFractionDigits: 0,
    maximumFractionDigits: isSubunitless ? 0 : 2,
  }).format(major);
  return `${symbol}${formatted}`;
}

/**
 * Parses a user-typed major-unit string (e.g. "1,200" or "500.50") into
 * integer minor units. Returns `null` if the input is not a valid amount.
 * Accepts decimal points only; commas are stripped before parsing.
 * Rejects scientific notation, signs, and other non-numeric characters.
 */
export function parseMajorToMinor(input: string): number | null {
  const stripped = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(stripped)) return null;
  const major = Number(stripped);
  if (!Number.isFinite(major) || major < 0) return null;
  return Math.round(major * 100);
}

/**
 * Returns the display symbol for a currency code (e.g. 'INR' → '₹').
 * Falls back to the code itself (with trailing space) for unknown codes.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? `${currency} `;
}

/** Format an integer minor amount as a user-editable major-unit string (no symbol). e.g. 50_000 → "500" */
export function formatMinorForInput(minor: number): string {
  const major = minor / 100;
  // Show two decimals only if needed (cents present).
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}
