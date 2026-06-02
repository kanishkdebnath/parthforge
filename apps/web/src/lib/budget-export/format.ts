import { formatMoney, getCurrencySymbol } from '../budget-formatting';

/** Minor units (1/100 of the major unit) → major unit number. JPY uses the same /100 convention; display rules differ but storage doesn't. */
export function minorToMajor(minor: number): number {
  return minor / 100;
}

/**
 * Excel cell number-format string for a currency.
 * Two decimals for everything except JPY (zero decimals).
 * Negative numbers in red with a leading hyphen.
 */
export function excelCurrencyFormat(currency: string): string {
  const symbol = getCurrencySymbol(currency).trim();
  const decimals = currency === 'JPY' ? '' : '.00';
  // If the currency code has no known symbol (getCurrencySymbol returns "XYZ " for unknown),
  // produce a plain numeric format without the code in quotes.
  const known = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'JPY'].includes(currency);
  if (!known) {
    return `#,##0${decimals};[Red]-#,##0${decimals}`;
  }
  return `"${symbol}"#,##0${decimals};[Red]-"${symbol}"#,##0${decimals}`;
}

/**
 * Signed display string for the PDF delta column.
 * +/−/none prefix, followed by `formatMoney` of the absolute value.
 * Uses U+2212 MINUS SIGN for negatives (not ASCII hyphen) to match the spec.
 */
export function formatSignedMoney(minor: number, currency: string): string {
  if (minor === 0) return formatMoney(0, currency);
  const sign = minor > 0 ? '+' : '−';
  return `${sign}${formatMoney(Math.abs(minor), currency)}`;
}
