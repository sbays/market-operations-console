/**
 * Generates src/pack/data.json and src/pack/fixtures.json.
 *
 * Deterministic: a seeded PRNG, so the same code always writes the same bytes. The brief's
 * stories are planted as explicit, named adjustments below; src/data/pack.test.ts checks that
 * each one shows up in the data. Run with `pnpm data:generate`.
 */
import { writeFileSync } from "node:fs";
import { DatasetSchema, FixturesSchema, type Dataset } from "@/domain/schema";
import { renderFixtures } from "./fixture-templates";

const SEED = 20261028;

// Periods: 24 reported months, plus 12 months of history so every prior-year value is real.
const FIRST_MONTH = { year: 2024, month: 10 };
const REPORTED_MONTHS = 24;
const HISTORY_MONTHS = 12;

const regions = [
  { id: "na", name: "North America" },
  { id: "eu", name: "Europe" },
  { id: "apac", name: "Asia Pacific" },
  { id: "latam", name: "Latin America" },
] as const;
type RegionId = (typeof regions)[number]["id"];

/** Monthly revenue at the start of the history, in USD. */
const markets: {
  id: string;
  name: string;
  regionId: RegionId;
  base: number;
}[] = [
  { id: "US", name: "United States", regionId: "na", base: 9_000_000 },
  { id: "CA", name: "Canada", regionId: "na", base: 1_600_000 },
  { id: "DE", name: "Germany", regionId: "eu", base: 4_400_000 },
  { id: "FR", name: "France", regionId: "eu", base: 3_200_000 },
  { id: "GB", name: "United Kingdom", regionId: "eu", base: 3_600_000 },
  { id: "IT", name: "Italy", regionId: "eu", base: 2_100_000 },
  { id: "ES", name: "Spain", regionId: "eu", base: 1_700_000 },
  { id: "JP", name: "Japan", regionId: "apac", base: 4_000_000 },
  { id: "AU", name: "Australia", regionId: "apac", base: 1_500_000 },
  { id: "IN", name: "India", regionId: "apac", base: 1_200_000 },
  { id: "BR", name: "Brazil", regionId: "latam", base: 1_400_000 },
  { id: "MX", name: "Mexico", regionId: "latam", base: 1_100_000 },
];

/** Year-on-year growth by region; `satisfies` makes a missing or mistyped region a compile error. */
const yearlyGrowth = {
  na: 0.05,
  eu: 0.02,
  apac: 0.12,
  latam: 0.06,
} satisfies Record<RegionId, number>;

/** Share of a market's revenue, unit price and typical market share by product. */
const products = [
  { id: "atlas", name: "Atlas", mix: 0.3, price: 120, share: 0.22 },
  { id: "beacon", name: "Beacon", mix: 0.32, price: 85, share: 0.26 },
  { id: "cirrus", name: "Cirrus", mix: 0.1, price: 200, share: 0.08 },
  { id: "delta", name: "Delta", mix: 0.18, price: 60, share: 0.15 },
  { id: "ember", name: "Ember", mix: 0.1, price: 150, share: 0.12 },
];

// Seeded PRNG (mulberry32) -----------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(SEED);
/** A multiplier around 1, e.g. jitter(0.03) is within ±1.5%. */
const jitter = (spread: number) => 1 + (random() - 0.5) * spread;

// Calendar ---------------------------------------------------------------------

function monthAt(index: number): { label: string; month: number } {
  const zeroBased = FIRST_MONTH.month - 1 + index;
  const year = FIRST_MONTH.year + Math.floor(zeroBased / 12);
  const month = (((zeroBased % 12) + 12) % 12) + 1;
  return { label: `${year}-${String(month).padStart(2, "0")}`, month };
}

// Planted stories ----------------------------------------------------------------

type Adjustment = {
  story: string;
  applies: (marketId: string, productId: string, period: string) => boolean;
  /** Multipliers on the generated value; omitted means unchanged. */
  actual?: number;
  forecast?: number;
};

const adjustments: Adjustment[] = [
  {
    story: "Germany March dip: distributor stock-out hits Beacon",
    applies: (m, p, period) =>
      m === "DE" && p === "beacon" && period === "2026-03",
    actual: 0.45,
  },
  {
    story: "Germany April: Beacon shipments partly restored",
    applies: (m, p, period) =>
      m === "DE" && p === "beacon" && period === "2026-04",
    actual: 0.85,
  },
  {
    story:
      "Germany Q3: forecast assumed a catch-up of March's lost sales that didn't come",
    applies: (m, _p, period) => m === "DE" && period >= "2026-07",
    forecast: 1.04,
  },
  {
    story: "Japan: aggressive forecasts since the FY26 plan (Oct 2025)",
    applies: (m, _p, period) => m === "JP" && period >= "2025-10",
    forecast: 1.06,
  },
  {
    story: "India: aggressive forecasts since the FY26 plan (Oct 2025)",
    applies: (m, _p, period) => m === "IN" && period >= "2025-10",
    forecast: 1.055,
  },
  {
    story: "Brazil: demand softened after the April 2026 devaluation",
    applies: (m, _p, period) => m === "BR" && period >= "2026-04",
    actual: 0.86,
  },
  {
    story:
      "Portfolio miss: the April 2026 plan moved growth onto the Cirrus relaunch",
    applies: (_m, p, period) => p === "cirrus" && period >= "2026-04",
    forecast: 1.5,
  },
  {
    story: "…taking forecast weight off the core products",
    applies: (_m, p, period) => p !== "cirrus" && period >= "2026-04",
    forecast: 0.955,
  },
];

const anomalies = [
  {
    ref: { level: "product", marketId: "DE", id: "beacon" },
    period: "2026-03",
    metric: "revenue",
    note: "A distributor stock-out in Germany held back most Beacon shipments in March.",
  },
  {
    ref: { level: "market", id: "BR" },
    period: "2026-04",
    metric: "revenue",
    note: "Demand in Brazil softened after the April currency devaluation and has not recovered.",
  },
];

function multiplier(
  field: "actual" | "forecast",
  marketId: string,
  productId: string,
  period: string,
): number {
  return adjustments
    .filter((a) => a.applies(marketId, productId, period))
    .reduce((product, a) => product * (a[field] ?? 1), 1);
}

// Generation -------------------------------------------------------------------

type Generated = {
  actual: number;
  forecast: number;
  units: number;
  marketSize: number;
};

function generate(): Dataset {
  const periods = Array.from(
    { length: REPORTED_MONTHS },
    (_, i) => monthAt(i).label,
  );

  const generatedMarkets = markets.map((market) => {
    const growth = yearlyGrowth[market.regionId];
    const series = Object.fromEntries(
      products.map((product) => {
        // Index -HISTORY_MONTHS .. REPORTED_MONTHS-1; history only feeds priorYear.
        const months: Generated[] = [];
        for (let i = -HISTORY_MONTHS; i < REPORTED_MONTHS; i++) {
          const { label, month } = monthAt(i);
          const trend = (1 + growth) ** ((i + HISTORY_MONTHS) / 12);
          const season = 1 + 0.06 * Math.sin((2 * Math.PI * (month - 1)) / 12);
          const expected = market.base * product.mix * trend * season;

          const actual =
            expected *
            jitter(0.03) *
            multiplier("actual", market.id, product.id, label);
          const forecast =
            expected * multiplier("forecast", market.id, product.id, label);
          months.push({
            actual,
            forecast,
            units: actual / product.price,
            // From the pre-adjustment value: a story changes our sales, not the category's size,
            // so a stock-out shows up as lost share.
            marketSize: expected / (product.share * jitter(0.04)),
          });
        }

        const points = periods.map((period, i) => {
          const current = months[i + HISTORY_MONTHS];
          const yearAgo = months[i];
          if (!current || !yearAgo) throw new Error(`Missing month ${period}`);
          return {
            period,
            actual: Math.round(current.actual),
            units: Math.round(current.units),
            forecast: Math.round(current.forecast),
            priorYear: Math.round(yearAgo.actual),
            marketSize: Math.round(current.marketSize),
          };
        });
        return [product.id, points];
      }),
    );
    return {
      id: market.id,
      name: market.name,
      regionId: market.regionId,
      series,
    };
  });

  return DatasetSchema.parse({
    currency: "USD",
    periods,
    regions,
    products: products.map(({ id, name }) => ({ id, name })),
    markets: generatedMarkets,
    anomalies,
  });
}

const dataset = generate();
const fixtures = FixturesSchema.parse(renderFixtures(dataset));

const packDir = new URL("../src/pack/", import.meta.url);
writeFileSync(new URL("data.json", packDir), `${JSON.stringify(dataset)}\n`);
writeFileSync(
  new URL("fixtures.json", packDir),
  `${JSON.stringify(fixtures, null, 2)}\n`,
);
console.log(
  `Wrote ${dataset.markets.length} markets × ${dataset.products.length} products × ${dataset.periods.length} months and ${fixtures.length} fixtures.`,
);
