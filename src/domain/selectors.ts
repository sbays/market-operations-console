/**
 * Pure derivations over the dataset. Every number the UI shows, and every number a citation
 * chip checks against, comes from here.
 */
import type {
  Dataset,
  EntityRef,
  Metric,
  Month,
  PeriodRef,
  Point,
  Quarter,
  Status,
} from "./schema";

/** Attainment thresholds for status, judged over a quarter. */
export const ON_TRACK_FROM = 0.98;
export const AT_RISK_FROM = 0.92;

const QUARTER = /^(\d{4})-Q([1-4])$/;

/** The dataset months a period covers: a month is itself, a quarter is its three months. */
export function expandPeriod(dataset: Dataset, period: PeriodRef): Month[] {
  const quarter = QUARTER.exec(period);
  if (!quarter) return dataset.periods.includes(period) ? [period] : [];

  const firstMonth = (Number(quarter[2]) - 1) * 3 + 1;
  const months = [0, 1, 2].map(
    (offset) => `${quarter[1]}-${String(firstMonth + offset).padStart(2, "0")}`,
  );
  return months.filter((month) => dataset.periods.includes(month));
}

/** Every product-market series under an entity, or undefined if the entity isn't in the data. */
function seriesUnder(dataset: Dataset, ref: EntityRef): Point[][] | undefined {
  const all = (markets: Dataset["markets"]) =>
    markets.flatMap((market) => Object.values(market.series));

  switch (ref.level) {
    case "portfolio":
      return all(dataset.markets);
    case "region": {
      if (!dataset.regions.some((r) => r.id === ref.id)) return undefined;
      return all(dataset.markets.filter((m) => m.regionId === ref.id));
    }
    case "market": {
      const market = dataset.markets.find((m) => m.id === ref.id);
      return market && Object.values(market.series);
    }
    case "product": {
      const series = dataset.markets.find((m) => m.id === ref.marketId)?.series[
        ref.id
      ];
      return series && [series];
    }
  }
}

type Totals = Omit<Point, "period">;

/** Undefined rather than Infinity or NaN when there is nothing to compare against. */
function ratio(numerator: number, denominator: number): number | undefined {
  return denominator === 0 ? undefined : numerator / denominator;
}

function totals(series: Point[][], months: Month[]): Totals {
  const sum: Totals = {
    actual: 0,
    units: 0,
    forecast: 0,
    priorYear: 0,
    marketSize: 0,
  };
  for (const points of series) {
    for (const point of points) {
      if (!months.includes(point.period)) continue;
      sum.actual += point.actual;
      sum.units += point.units;
      sum.forecast += point.forecast;
      sum.priorYear += point.priorYear;
      sum.marketSize += point.marketSize;
    }
  }
  return sum;
}

/**
 * The value of one metric for one entity over one period, or undefined when the entity or
 * period is outside the data. Ratios are computed from summed facts, so they roll up exactly.
 */
export function valueAt(
  dataset: Dataset,
  ref: EntityRef,
  period: PeriodRef,
  metric: Metric,
): number | undefined {
  const series = seriesUnder(dataset, ref);
  const months = expandPeriod(dataset, period);
  if (!series || months.length === 0) return undefined;

  const sum = totals(series, months);
  switch (metric) {
    case "revenue":
      return sum.actual;
    case "units":
      return sum.units;
    case "forecast":
      return sum.forecast;
    case "attainment":
      return ratio(sum.actual, sum.forecast);
    case "growth": {
      const vsPriorYear = ratio(sum.actual, sum.priorYear);
      return vsPriorYear === undefined ? undefined : vsPriorYear - 1;
    }
    case "share":
      return ratio(sum.actual, sum.marketSize);
  }
}

export function statusForAttainment(attainment: number): Status {
  if (attainment >= ON_TRACK_FROM) return "on-track";
  if (attainment >= AT_RISK_FROM) return "at-risk";
  return "off-track";
}

export function statusOf(
  dataset: Dataset,
  ref: EntityRef,
  quarter: Quarter,
): Status | undefined {
  const attainment = valueAt(dataset, ref, quarter, "attainment");
  return attainment === undefined ? undefined : statusForAttainment(attainment);
}

export function statusCounts(
  dataset: Dataset,
  quarter: Quarter,
): Record<Status, number> {
  const counts: Record<Status, number> = {
    "on-track": 0,
    "at-risk": 0,
    "off-track": 0,
  };
  for (const market of dataset.markets) {
    const status = statusOf(
      dataset,
      { level: "market", id: market.id },
      quarter,
    );
    if (status) counts[status] += 1;
  }
  return counts;
}

/** The most recent quarter whose three months are all in the data. */
export function latestQuarter(dataset: Dataset): Quarter | undefined {
  for (const month of [...dataset.periods].reverse()) {
    const [year, monthNumber] = month.split("-").map(Number);
    if (year === undefined || monthNumber === undefined) continue;
    if (monthNumber % 3 !== 0) continue;
    const quarter = `${year}-Q${monthNumber / 3}`;
    if (expandPeriod(dataset, quarter).length === 3) return quarter;
  }
  return undefined;
}

/** The entities one level below `ref`, in dataset order. */
export function childrenOf(dataset: Dataset, ref: EntityRef): EntityRef[] {
  switch (ref.level) {
    case "portfolio":
      return dataset.regions.map((r) => ({ level: "region", id: r.id }));
    case "region":
      return dataset.markets
        .filter((m) => m.regionId === ref.id)
        .map((m) => ({ level: "market", id: m.id }));
    case "market":
      return dataset.products.map((p) => ({
        level: "product",
        marketId: ref.id,
        id: p.id,
      }));
    case "product":
      return [];
  }
}

export type Mover = { ref: EntityRef; growth: number };

/** Markets with the highest and lowest growth against the prior year over a period. */
export function topMovers(
  dataset: Dataset,
  period: PeriodRef,
  count: number,
): { up: Mover[]; down: Mover[] } {
  const movers: Mover[] = [];
  for (const market of dataset.markets) {
    const ref: EntityRef = { level: "market", id: market.id };
    const growth = valueAt(dataset, ref, period, "growth");
    if (growth !== undefined) movers.push({ ref, growth });
  }
  const ranked = movers.sort((a, b) => b.growth - a.growth);
  return {
    up: ranked.slice(0, count),
    down: ranked.slice(-count).reverse(),
  };
}

export type ConfidenceBand = "high" | "medium" | "low";

/** Model confidence thresholds for the High / Medium / Low badge. */
export const HIGH_CONFIDENCE_FROM = 0.75;
export const MEDIUM_CONFIDENCE_FROM = 0.5;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= HIGH_CONFIDENCE_FROM) return "high";
  if (confidence >= MEDIUM_CONFIDENCE_FROM) return "medium";
  return "low";
}
