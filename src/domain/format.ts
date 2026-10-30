/**
 * All number and date formatting goes through this module.
 * The locale is fixed so server and client render identical strings (no hydration mismatch)
 * and AI-quoted numbers format exactly like source data.
 */
import { parsePeriod } from "./period";
import type { Metric, Month, PeriodRef, Status } from "./schema";

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

const wholePercent = new Intl.NumberFormat(LOCALE, {
  style: "percent",
  maximumFractionDigits: 0,
});

/** A percentage as the user typed it, not a ratio: 95 → "95%", 1000 → "1,000%". */
export function formatTypedPercent(value: number): string {
  return wholePercent.format(value / 100);
}

const points = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: PERCENT_DECIMALS,
  maximumFractionDigits: PERCENT_DECIMALS,
});

/** A gap in percentage points, as in "14.5 points under forecast". Not a ratio: 14.5 is 14.5. */
export function formatPoints(value: number): string {
  return `${points.format(value)} points`;
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

const list = new Intl.ListFormat(LOCALE, { type: "conjunction" });

/** ["Mar 2026", "Apr 2026"] → "Mar 2026 and Apr 2026". */
export function formatList(items: string[]): string {
  return list.format(items);
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

const METRIC_NAMES: Record<Metric, string> = {
  revenue: "Revenue",
  units: "Units",
  forecast: "Forecast",
  growth: "Growth vs prior year",
  attainment: "Forecast attainment",
  share: "Market share",
};

export function formatMetricName(metric: Metric): string {
  return METRIC_NAMES[metric];
}

const METRIC_SHORT_NAMES: Record<Metric, string> = {
  revenue: "Revenue",
  units: "Units",
  forecast: "Forecast",
  growth: "Growth",
  attainment: "Attainment",
  share: "Market share",
};

/** A metric's brief name, for controls and sentences: "Growth", "Market share". */
export function formatMetricShortName(metric: Metric): string {
  return METRIC_SHORT_NAMES[metric];
}

/** The months a dataset covers: "Oct 2024 to Sep 2026". */
export function formatCoverage({
  from,
  to,
}: {
  from: Month;
  to: Month;
}): string {
  return `${formatPeriod(from)} to ${formatPeriod(to)}`;
}

const STATUS_NAMES: Record<Status, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};

/** The text label that always accompanies a status colour and icon. */
export function formatStatus(status: Status): string {
  return STATUS_NAMES[status];
}

/** A metric value, or "No data" when the data doesn't cover it. */
export function formatMetricOrMissing(
  metric: Metric,
  value: number | undefined,
): string {
  return value === undefined ? "No data" : formatMetric(metric, value);
}

const milliseconds = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
});
const layoutShift = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** A Core Web Vitals reading for the console: "LCP 1,235ms (good)", "CLS 0.081 (good)". */
export function formatWebVital({
  name,
  value,
  rating,
}: {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
}): string {
  // CLS is a unitless score; every other vital is a duration in milliseconds.
  const reading =
    name === "CLS"
      ? layoutShift.format(value)
      : `${milliseconds.format(value)}ms`;
  return `${name} ${reading} (${rating.replace("-", " ")})`;
}
