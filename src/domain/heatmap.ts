/**
 * The attainment grid behind the heat map: one row per child of a selection, one cell per
 * month. Every value comes from valueAt, so a cell always matches the KPI and table figures.
 */
import { formatPercent, formatPeriod } from "./format";
import type { Dataset, EntityRef, Month } from "./schema";
import { childrenOf, entityLabel, valueAt } from "./selectors";

export type HeatmapCell = { period: Month; attainment: number | undefined };
export type HeatmapRow = { ref: EntityRef; cells: HeatmapCell[] };

/** One row per child of `ref`, one cell per dataset month. Empty below a product. */
export function heatmapRows(dataset: Dataset, ref: EntityRef): HeatmapRow[] {
  return childrenOf(dataset, ref).map((child) => ({
    ref: child,
    cells: dataset.periods.map((period) => ({
      period,
      attainment: valueAt(dataset, child, period, "attainment"),
    })),
  }));
}

/** Attainment this far from 100% (on either side) reaches the full colour of its side. */
const FULL_COLOUR_SPREAD = 0.2;

/**
 * A CSS colour built only from tokens: below 100% mixes toward the negative token, above
 * toward the positive one, and fades to the midpoint at 100%. Undefined (no data) is muted.
 */
export function heatColour(attainment: number | undefined): string {
  if (attainment === undefined) return "var(--muted)";
  const side =
    attainment < 1 ? "var(--diverging-negative)" : "var(--diverging-positive)";
  const share = Math.min(1, Math.abs(attainment - 1) / FULL_COLOUR_SPREAD);
  const percent = Math.round(share * 100);
  if (percent === 0) return "var(--diverging-midpoint)";
  if (percent === 100) return side;
  return `color-mix(in oklch, ${side} ${percent}%, var(--diverging-midpoint))`;
}

/** Names the lowest attainment in the grid, the cell a reader most needs to find. */
export function heatmapSummary(dataset: Dataset, rows: HeatmapRow[]): string {
  let lowest: { ref: EntityRef; period: Month; attainment: number } | undefined;
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.attainment === undefined) continue;
      if (lowest === undefined || cell.attainment < lowest.attainment) {
        lowest = {
          ref: row.ref,
          period: cell.period,
          attainment: cell.attainment,
        };
      }
    }
  }
  if (lowest === undefined) return "No attainment data for this selection.";
  return `Lowest: ${entityLabel(dataset, lowest.ref)}, ${formatPeriod(lowest.period)}, at ${formatPercent(lowest.attainment)} of forecast.`;
}
