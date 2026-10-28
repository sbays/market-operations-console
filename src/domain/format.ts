/**
 * All number and date formatting goes through this module.
 * The locale is fixed so server and client render identical strings (no hydration mismatch)
 * and AI-quoted numbers format exactly like source data.
 */
import { parsePeriod } from "./period";
import type { Metric, PeriodRef } from "./schema";

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

/** Decimal places shown for percentages; status decisions round to the same precision. */
export const PERCENT_DECIMALS = 1;

const percent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: PERCENT_DECIMALS,
  maximumFractionDigits: PERCENT_DECIMALS,
});

const signedPercent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  minimumFractionDigits: PERCENT_DECIMALS,
  maximumFractionDigits: PERCENT_DECIMALS,
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

/** "2026-03" → "Mar 2026", "2026-Q3" → "Q3 2026". */
export function formatPeriod(period: PeriodRef): string {
  const parsed = parsePeriod(period);
  if (!parsed) throw new RangeError(`Not a period: ${period}`);
  if (parsed.kind === "quarter") return `Q${parsed.quarter} ${parsed.year}`;
  return month.format(Date.UTC(parsed.year, parsed.month - 1));
}

/** The single place that decides how each metric reads, for charts, tables and AI text alike. */
export function formatMetric(metric: Metric, value: number): string {
  switch (metric) {
    case "revenue":
    case "forecast":
      return formatCurrency(value);
    case "units":
      return formatNumber(value);
    case "attainment":
    case "share":
      return formatPercent(value);
    case "growth":
      return formatPercent(value, { signed: true });
  }
}
