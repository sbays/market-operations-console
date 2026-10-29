/**
 * Derivations for the compare radar. Raw values come from valueAt, so the radar, its table and
 * its summary can't disagree with the KPI strip. Scaled values only position the polygon.
 */
import { formatMetricName, formatPeriod } from "./format";
import type { Dataset, EntityRef, PeriodRef } from "./schema";
import { entityLabel, valueAt } from "./selectors";

export const RADAR_METRICS = [
  "revenue",
  "units",
  "growth",
  "attainment",
  "share",
] as const;
export type RadarMetric = (typeof RADAR_METRICS)[number];

/** A raw value and its distance from the centre (0..1). No data has no position. */
export type RadarValue =
  { raw: number; scaled: number } | { raw: undefined; scaled: undefined };
type PerMetric<T> = Record<RadarMetric, T>;

export type RadarSeries = {
  ref: EntityRef;
  values: PerMetric<RadarValue>;
};

/**
 * One series per entity, with every axis scaled to 0..1 across the entities given.
 * Growth is centred: the largest move in either direction reaches the rim, and zero growth
 * sits at 0.5. An axis with no non-zero value scales to 0 for everyone. A missing value gets
 * no position: the centre would read as the lowest value.
 */
export function radarAxes(
  dataset: Dataset,
  refs: EntityRef[],
  period: PeriodRef,
): RadarSeries[] {
  const rows = refs.map((ref) => ({
    ref,
    raw: readRaw(dataset, ref, period),
  }));
  const raws = rows.map((row) => row.raw);
  const largest: PerMetric<number> = {
    revenue: largestMagnitude(raws, "revenue"),
    units: largestMagnitude(raws, "units"),
    growth: largestMagnitude(raws, "growth"),
    attainment: largestMagnitude(raws, "attainment"),
    share: largestMagnitude(raws, "share"),
  };

  return rows.map(({ ref, raw }) => ({
    ref,
    values: {
      revenue: scaled("revenue", raw.revenue, largest.revenue),
      units: scaled("units", raw.units, largest.units),
      growth: scaled("growth", raw.growth, largest.growth),
      attainment: scaled("attainment", raw.attainment, largest.attainment),
      share: scaled("share", raw.share, largest.share),
    },
  }));
}

function readRaw(
  dataset: Dataset,
  ref: EntityRef,
  period: PeriodRef,
): PerMetric<number | undefined> {
  return {
    revenue: valueAt(dataset, ref, period, "revenue"),
    units: valueAt(dataset, ref, period, "units"),
    growth: valueAt(dataset, ref, period, "growth"),
    attainment: valueAt(dataset, ref, period, "attainment"),
    share: valueAt(dataset, ref, period, "share"),
  };
}

function largestMagnitude(
  raws: PerMetric<number | undefined>[],
  metric: RadarMetric,
): number {
  let largest = 0;
  for (const raw of raws) {
    const value = raw[metric];
    if (value !== undefined) largest = Math.max(largest, Math.abs(value));
  }
  return largest;
}

function scaled(
  metric: RadarMetric,
  raw: number | undefined,
  largest: number,
): RadarValue {
  if (raw === undefined) return { raw, scaled: undefined };
  if (largest === 0) return { raw, scaled: 0 };
  const position =
    metric === "growth" ? (raw / largest + 1) / 2 : raw / largest;
  return { raw, scaled: position };
}

/** Joins words the way a sentence does: "A, B and C". */
function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/** "Comparing Germany and United States in Q1 2026 on revenue, ... . United States leads on revenue." */
export function radarSummary(
  dataset: Dataset,
  series: RadarSeries[],
  period: PeriodRef,
): string {
  const names = series.map((s) => entityLabel(dataset, s.ref));
  const metrics = RADAR_METRICS.map((metric) =>
    formatMetricName(metric).toLowerCase(),
  );
  const head = `Comparing ${joinWords(names)} in ${formatPeriod(period)} on ${joinWords(metrics)}.`;

  const withRevenue = series.flatMap((s) => {
    const raw = s.values.revenue.raw;
    return raw === undefined ? [] : [{ ref: s.ref, raw }];
  });
  const leader = [...withRevenue].sort((a, b) => b.raw - a.raw)[0];
  if (leader === undefined) return head;
  return `${head} ${entityLabel(dataset, leader.ref)} leads on revenue.`;
}
