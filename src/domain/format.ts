/**
 * All number and date formatting goes through this module.
 * The locale is fixed so server and client render identical strings (no hydration mismatch)
 * and AI-quoted numbers format exactly like source data.
 */
export const LOCALE = "en-US";
export const CURRENCY = "USD";

const currency = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCurrency(value: number): string {
  return currency.format(value);
}

const percent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const signedPercent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

/** `value` is a ratio: 0.042 → "4.2%". Use `signed` for changes such as growth. */
export function formatPercent(
  value: number,
  options: { signed?: boolean } = {},
): string {
  return (options.signed ? signedPercent : percent).format(value);
}

const compactNumber = new Intl.NumberFormat(LOCALE, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
  return compactNumber.format(value);
}

// UTC so a month never shifts across a time-zone boundary.
const month = new Intl.DateTimeFormat(LOCALE, {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const QUARTER = /^(\d{4})-Q([1-4])$/;
const MONTH = /^(\d{4})-(\d{2})$/;

/** "2026-03" → "Mar 2026", "2026-Q3" → "Q3 2026". */
export function formatPeriod(period: string): string {
  const quarter = QUARTER.exec(period);
  if (quarter) return `Q${quarter[2]} ${quarter[1]}`;

  const parts = MONTH.exec(period);
  if (!parts) throw new RangeError(`Not a period: ${period}`);
  return month.format(Date.UTC(Number(parts[1]), Number(parts[2]) - 1));
}
