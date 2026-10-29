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
import { formatPercent, formatPoints, PERCENT_DECIMALS } from "./format";
import { monthKey, monthsOfQuarter, parsePeriod, quarterKey } from "./period";

/** Attainment thresholds for status, judged over a quarter. */
export const ON_TRACK_FROM = 0.98;
export const AT_RISK_FROM = 0.92;

/**
 * The dataset months a period covers: a month is itself, a quarter is its three months.
 * A period the data doesn't fully cover returns [], so a partial quarter is never summed
 * as if it were complete.
 */
export function expandPeriod(dataset: Dataset, period: PeriodRef): Month[] {
  const parsed = parsePeriod(period);
  if (!parsed) return [];
  const months =
    parsed.kind === "month"
      ? [monthKey(parsed.year, parsed.month)]
      : monthsOfQuarter(parsed.year, parsed.quarter);
  return months.every((m) => dataset.periods.includes(m)) ? months : [];
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

/**
 * Compares the attainment as it is displayed (rounded to PERCENT_DECIMALS), so a status
 * badge can never disagree with the percentage shown beside it.
 */
/** An attainment ratio rounded as it is displayed (to PERCENT_DECIMALS of a percent). */
function displayedAttainment(attainment: number): number {
  const scale = 10 ** (PERCENT_DECIMALS + 2);
  return Math.round(attainment * scale) / scale;
}

export function statusForAttainment(attainment: number): Status {
  const displayed = displayedAttainment(attainment);
  if (displayed >= ON_TRACK_FROM) return "on-track";
  if (displayed >= AT_RISK_FROM) return "at-risk";
  return "off-track";
}

export function statusOf(
  dataset: Dataset,
  ref: EntityRef,
  quarter: Quarter,
): Status | undefined {
  return statusAt(dataset, ref, quarter);
}

/** The status of an entity over a month or a quarter, or undefined outside the data. */
export function statusAt(
  dataset: Dataset,
  ref: EntityRef,
  period: PeriodRef,
): Status | undefined {
  const attainment = valueAt(dataset, ref, period, "attainment");
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
  // Periods are consecutive months in order (the schema guarantees it).
  for (const month of [...dataset.periods].reverse()) {
    const parsed = parsePeriod(month);
    if (parsed?.kind !== "month" || parsed.month % 3 !== 0) continue;
    const quarter = quarterKey(parsed.year, parsed.month / 3);
    if (expandPeriod(dataset, quarter).length > 0) return quarter;
  }
  return undefined;
}

/**
 * The period a view should show: the requested one when the data covers it, otherwise the
 * latest complete quarter, otherwise the last month.
 */
export function selectionPeriod(
  dataset: Dataset,
  period: PeriodRef | null,
): PeriodRef {
  if (period !== null && expandPeriod(dataset, period).length > 0) {
    return period;
  }
  return latestQuarter(dataset) ?? coverageOf(dataset).to;
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

/** The chain from the portfolio down to `ref`, inclusive, for breadcrumbs. */
export function ancestorsOf(dataset: Dataset, ref: EntityRef): EntityRef[] {
  const portfolio: EntityRef = { level: "portfolio" };
  switch (ref.level) {
    case "portfolio":
      return [portfolio];
    case "region":
      return [portfolio, ref];
    case "market":
    case "product": {
      const marketId = ref.level === "market" ? ref.id : ref.marketId;
      const market = dataset.markets.find((m) => m.id === marketId);
      if (!market) return [portfolio, ref];
      const region: EntityRef = { level: "region", id: market.regionId };
      const marketRef: EntityRef = { level: "market", id: market.id };
      return ref.level === "market"
        ? [portfolio, region, marketRef]
        : [portfolio, region, marketRef, ref];
    }
  }
}

export type TrendPoint = {
  period: Month;
  actual: number;
  forecast: number;
  priorYear: number;
};

/** One point per dataset month for the trend chart, or [] when the entity isn't in the data. */
export function monthlySeries(dataset: Dataset, ref: EntityRef): TrendPoint[] {
  const series = seriesUnder(dataset, ref);
  if (!series) return [];
  return dataset.periods.map((period) => {
    const sum = totals(series, [period]);
    return {
      period,
      actual: sum.actual,
      forecast: sum.forecast,
      priorYear: sum.priorYear,
    };
  });
}

export type Mover = { ref: EntityRef; growth: number };

/**
 * The entities in `refs` that grew most and declined most against the prior year over a period.
 * Only growth goes under `up` and only decline under `down`, so a list can be empty.
 */
export function topMovers(
  dataset: Dataset,
  refs: EntityRef[],
  period: PeriodRef,
  count: number,
): { up: Mover[]; down: Mover[] } {
  const movers: Mover[] = [];
  for (const ref of refs) {
    const growth = valueAt(dataset, ref, period, "growth");
    if (growth !== undefined) movers.push({ ref, growth });
  }
  const limit = Math.max(0, count);
  return {
    up: movers
      .filter((m) => m.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, limit),
    down: movers
      .filter((m) => m.growth < 0)
      .sort((a, b) => a.growth - b.growth)
      .slice(0, limit),
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

/** The months the data covers, as quoted by an abstention. */
export function coverageOf(dataset: Dataset): { from: Month; to: Month } {
  const from = dataset.periods[0];
  const to = dataset.periods.at(-1);
  // The schema requires at least one period, so this only guards the index types.
  if (!from || !to) throw new Error("Dataset has no periods");
  return { from, to };
}

/** The URL form of a drill path: "eu.DE.beacon" is region, market, product; "" is the portfolio. */
export function refFromPath(
  dataset: Dataset,
  path: string,
): EntityRef | undefined {
  if (path === "") return { level: "portfolio" };
  const [regionId, marketId, productId, ...rest] = path.split(".");
  if (rest.length > 0) return undefined;

  const region = dataset.regions.find((r) => r.id === regionId);
  if (!region) return undefined;
  if (marketId === undefined) return { level: "region", id: region.id };

  const market = dataset.markets.find(
    (m) => m.id === marketId && m.regionId === region.id,
  );
  if (!market) return undefined;
  if (productId === undefined) return { level: "market", id: market.id };

  const product = dataset.products.find((p) => p.id === productId);
  if (!product) return undefined;
  return { level: "product", marketId: market.id, id: product.id };
}

/** The inverse of refFromPath; undefined when the ref's market isn't in the data. */
export function pathOf(dataset: Dataset, ref: EntityRef): string | undefined {
  switch (ref.level) {
    case "portfolio":
      return "";
    case "region":
      return ref.id;
    case "market":
    case "product": {
      const marketId = ref.level === "market" ? ref.id : ref.marketId;
      const market = dataset.markets.find((m) => m.id === marketId);
      if (!market) return undefined;
      const marketPath = `${market.regionId}.${market.id}`;
      return ref.level === "market" ? marketPath : `${marketPath}.${ref.id}`;
    }
  }
}

/** A display name for any entity: "Germany", "Beacon in Germany". */
export function entityName(
  dataset: Dataset,
  ref: EntityRef,
): string | undefined {
  switch (ref.level) {
    case "portfolio":
      return "Portfolio";
    case "region":
      return dataset.regions.find((r) => r.id === ref.id)?.name;
    case "market":
      return dataset.markets.find((m) => m.id === ref.id)?.name;
    case "product": {
      const market = dataset.markets.find((m) => m.id === ref.marketId);
      const product = dataset.products.find((p) => p.id === ref.id);
      return market && product
        ? `${product.name} in ${market.name}`
        : undefined;
    }
  }
}

/**
 * The short label a citation chip shows: market codes as the data writes them, names
 * otherwise. Never undefined, so a citation the data can't resolve still says what it cites.
 */
export function entityCode(dataset: Dataset, ref: EntityRef): string {
  switch (ref.level) {
    case "market":
      return ref.id;
    case "product": {
      const product = dataset.products.find((p) => p.id === ref.id);
      return `${ref.marketId} ${product?.name ?? ref.id}`;
    }
    case "region":
      return entityName(dataset, ref) ?? ref.id;
    case "portfolio":
      return "Portfolio";
  }
}

/** The label a view shows for an entity: its name, or the short code when it has none. */
export function entityLabel(dataset: Dataset, ref: EntityRef): string {
  return entityName(dataset, ref) ?? entityCode(dataset, ref);
}

const CHILD_LEVEL: Record<EntityRef["level"], EntityRef["level"] | undefined> =
  {
    portfolio: "region",
    region: "market",
    market: "product",
    product: undefined,
  };

/** The level one below `ref` (what childrenOf returns), or undefined below a product. */
export function childLevelOf(ref: EntityRef): EntityRef["level"] | undefined {
  return CHILD_LEVEL[ref.level];
}

/** How many of `ref`'s children are in each status over a period; children with no status are left out. */
export function childStatusCounts(
  dataset: Dataset,
  ref: EntityRef,
  period: PeriodRef,
): Record<Status, number> {
  const counts: Record<Status, number> = {
    "on-track": 0,
    "at-risk": 0,
    "off-track": 0,
  };
  for (const child of childrenOf(dataset, ref)) {
    const status = statusAt(dataset, child, period);
    if (status) counts[status] += 1;
  }
  return counts;
}

export type Risk = {
  ref: EntityRef;
  status: Extract<Status, "at-risk" | "off-track">;
  attainment: number;
  reason: string;
};

/**
 * The reason a risk is shown: the note of an anomaly recorded against that child in the period
 * shown, or else a sentence about the shortfall. The note is only used when the child's path
 * matches the anomaly's, so one entity never borrows another's explanation.
 */
function riskReason(
  dataset: Dataset,
  ref: EntityRef,
  period: PeriodRef,
  attainment: number,
): string {
  const path = pathOf(dataset, ref);
  const months = expandPeriod(dataset, period);
  const note =
    path === undefined
      ? undefined
      : dataset.anomalies.find(
          (anomaly) =>
            pathOf(dataset, anomaly.ref) === path &&
            months.includes(anomaly.period),
        )?.note;
  if (note !== undefined) return note;
  const displayed = displayedAttainment(attainment);
  return `Attainment ${formatPercent(displayed)}, ${formatPoints((1 - displayed) * 100)} under forecast.`;
}

/**
 * The children of `selected` that are at risk or off track over a period, lowest attainment
 * first, at most `count`. Children with no status (outside the data) are left out.
 */
export function topRisks(
  dataset: Dataset,
  selected: EntityRef,
  period: PeriodRef,
  count: number,
): Risk[] {
  const flagged: {
    ref: EntityRef;
    status: Risk["status"];
    attainment: number;
  }[] = [];
  for (const ref of childrenOf(dataset, selected)) {
    const attainment = valueAt(dataset, ref, period, "attainment");
    if (attainment === undefined) continue;
    // The same status statusAt would give, without reading the attainment twice.
    const status = statusForAttainment(attainment);
    if (status === "on-track") continue;
    flagged.push({ ref, status, attainment });
  }
  return flagged
    .sort((a, b) => a.attainment - b.attainment)
    .slice(0, Math.max(0, count))
    .map(({ ref, status, attainment }) => ({
      ref,
      status,
      attainment,
      reason: riskReason(dataset, ref, period, attainment),
    }));
}
