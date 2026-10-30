/**
 * Plain-language sentences about a selection, built from the same formatters as every other
 * number on screen so a sentence never shows a figure the chart doesn't.
 */
import {
  formatCurrency,
  formatList,
  formatPercent,
  formatPeriod,
} from "./format";
import type { Month } from "./schema";
import type { TrendPoint } from "./selectors";

/**
 * "Germany revenue, Jan 2026 to Jun 2026: $150 in Jun 2026, 75.0% of forecast.", plus the
 * months with a flagged anomaly when the chart marks any.
 */
export function trendSummary(
  points: TrendPoint[],
  name: string,
  anomalyMonths: Month[] = [],
): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return `${name}: no data for this selection.`;

  const span = `${formatPeriod(first.period)} to ${formatPeriod(last.period)}`;
  const latest = `${formatCurrency(last.actual)} in ${formatPeriod(last.period)}`;
  const against =
    last.forecast === 0
      ? ""
      : `, ${formatPercent(last.actual / last.forecast)} of forecast`;
  const flagged =
    anomalyMonths.length === 0
      ? ""
      : ` ${anomalyMonths.length === 1 ? "Anomaly" : "Anomalies"} flagged in ${formatList(anomalyMonths.toSorted().map(formatPeriod))}.`;
  return `${name} revenue, ${span}: ${latest}${against}.${flagged}`;
}
