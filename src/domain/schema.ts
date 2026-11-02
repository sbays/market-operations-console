import { z } from "zod";
import { MonthSchema, nextMonth, parsePeriod } from "./period";

export { MonthSchema, PeriodRefSchema, QuarterSchema } from "./period";
export type { Month, PeriodRef, Quarter } from "./period";

// Identifiers --------------------------------------------------------------

export const RegionIdSchema = z.string().regex(/^[a-z]+$/);
/** The starter pack's market id: ISO 3166-1 alpha-2 in lower case, e.g. "de". */
export const MarketIdSchema = z.string().regex(/^[a-z]{2}$/);
export const ProductIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

export type RegionId = z.infer<typeof RegionIdSchema>;
export type MarketId = z.infer<typeof MarketIdSchema>;
export type ProductId = z.infer<typeof ProductIdSchema>;

/** The one way to point at a node of the hierarchy: URL, charts and citations all use it. */
export const EntityRefSchema = z.discriminatedUnion("level", [
  z.object({ level: z.literal("portfolio") }),
  z.object({ level: z.literal("region"), id: RegionIdSchema }),
  z.object({ level: z.literal("market"), id: MarketIdSchema }),
  // A product is sold in every market, so it is only unique together with its market.
  z.object({
    level: z.literal("product"),
    marketId: MarketIdSchema,
    id: ProductIdSchema,
  }),
]);
export type EntityRef = z.infer<typeof EntityRefSchema>;

/**
 * An entity as a string, for URLs and keys: "eu.de.nuvora" is region, market, product, and ""
 * is the portfolio. Comes from pathOf; a raw string from a URL goes through refFromPath.
 */
export const EntityPathSchema = z.string().brand<"EntityPath", "inout">();
export type EntityPath = z.infer<typeof EntityPathSchema>;

// Dataset ------------------------------------------------------------------

export const MetricSchema = z.enum([
  "revenue",
  "units",
  "forecast",
  "growth",
  "attainment",
  "share",
]);
export type Metric = z.infer<typeof MetricSchema>;

export const StatusSchema = z.enum(["on-track", "at-risk", "off-track"]);
export type Status = z.infer<typeof StatusSchema>;

const amount = z.number().nonnegative();

/**
 * One product in one market for one month. Only facts are stored; growth, attainment,
 * share and status are derived by selectors so they can never disagree with the facts.
 */
export const PointSchema = z.object({
  period: MonthSchema,
  actual: amount,
  units: amount,
  forecast: amount,
  priorYear: amount,
});
export type Point = z.infer<typeof PointSchema>;

export const RegionSchema = z.object({ id: RegionIdSchema, name: z.string() });
export const ProductSchema = z.object({
  id: ProductIdSchema,
  name: z.string(),
});
export const MarketSchema = z.object({
  id: MarketIdSchema,
  /** ISO 3166-1 alpha-2 as written ("de"), the short code a chip shows. */
  iso2: z.string().regex(/^[A-Z]{2}$/),
  name: z.string(),
  regionId: RegionIdSchema,
  series: z.record(ProductIdSchema, z.array(PointSchema)),
  /**
   * Total category revenue in the market, by month, for the months the data states a share
   * for. Share is Σactual / ΣmarketSize, so it rolls up; a month without one has no share.
   */
  marketSize: z.record(z.string(), z.number().positive()),
});

/** A stored annotation: the reason behind an unusual value, which no selector can derive. */
export const AnomalySchema = z.object({
  ref: EntityRefSchema,
  period: MonthSchema,
  metric: MetricSchema,
  note: z.string().min(1),
});

export type Region = z.infer<typeof RegionSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Market = z.infer<typeof MarketSchema>;
export type Anomaly = z.infer<typeof AnomalySchema>;

function describeRef(ref: EntityRef): string {
  switch (ref.level) {
    case "portfolio":
      return "portfolio";
    case "product":
      return `product ${ref.marketId}/${ref.id}`;
    default:
      return `${ref.level} ${ref.id}`;
  }
}

export const DatasetSchema = z
  .object({
    currency: z.literal("USD"),
    periods: z.array(MonthSchema).min(1),
    regions: z.array(RegionSchema).min(1),
    products: z.array(ProductSchema).min(1),
    markets: z.array(MarketSchema).min(1),
    anomalies: z.array(AnomalySchema),
  })
  .superRefine((dataset, ctx) => {
    const regionIds = new Set(dataset.regions.map((r) => r.id));
    const marketIds = new Set(dataset.markets.map((m) => m.id));
    const productIds = new Set(dataset.products.map((p) => p.id));
    const periods = dataset.periods.join();

    const fail = (message: string) => ctx.addIssue({ code: "custom", message });

    for (const [kind, ids] of [
      ["region", dataset.regions.map((r) => r.id)],
      ["market", dataset.markets.map((m) => m.id)],
      ["product", dataset.products.map((p) => p.id)],
    ] as const) {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) fail(`Duplicate ${kind} id ${id}`);
        seen.add(id);
      }
    }

    for (let i = 1; i < dataset.periods.length; i++) {
      const previous = parsePeriod(dataset.periods[i - 1] ?? "");
      if (
        previous?.kind !== "month" ||
        nextMonth(previous.year, previous.month) !== dataset.periods[i]
      ) {
        fail("Periods must be consecutive months in order");
        break;
      }
    }

    for (const market of dataset.markets) {
      if (!regionIds.has(market.regionId)) {
        fail(`Market ${market.id} is in unknown region "${market.regionId}"`);
      }
      for (const productId of Object.keys(market.series)) {
        if (!productIds.has(productId)) {
          fail(
            `Market ${market.id} has a series for unknown product ${productId}`,
          );
        }
      }
      for (const product of dataset.products) {
        const series = market.series[product.id];
        if (!series) {
          fail(`Market ${market.id} has no series for product ${product.id}`);
        } else if (series.map((p) => p.period).join() !== periods) {
          fail(
            `Series ${market.id}/${product.id} does not match the dataset periods`,
          );
        }
      }
      for (const month of Object.keys(market.marketSize)) {
        if (!dataset.periods.some((period) => period === month)) {
          fail(
            `Market ${market.id} has a market size for unknown month ${month}`,
          );
        }
      }
    }

    const resolves = (ref: EntityRef): boolean => {
      switch (ref.level) {
        case "portfolio":
          return true;
        case "region":
          return regionIds.has(ref.id);
        case "market":
          return marketIds.has(ref.id);
        case "product":
          return marketIds.has(ref.marketId) && productIds.has(ref.id);
      }
    };

    for (const anomaly of dataset.anomalies) {
      if (!resolves(anomaly.ref)) {
        fail(`Anomaly refers to unknown entity ${describeRef(anomaly.ref)}`);
      }
      if (!dataset.periods.includes(anomaly.period)) {
        fail(`Anomaly refers to unknown period ${anomaly.period}`);
      }
    }
  });
export type Dataset = z.infer<typeof DatasetSchema>;

// Stream contract (src/pack/CONTRACT.md) -------------------------------------

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** How an answer ended: a full answer, a hedged one, a refusal, or a failure. */
export const AnswerKindSchema = z.enum([
  "normal",
  "low_confidence",
  "abstain",
  "error",
]);
export type AnswerKind = z.infer<typeof AnswerKindSchema>;

/**
 * Points a claim at the data. Every field is optional on the wire, and ids are plain strings:
 * a citation the data can't resolve is shown as unverified, not dropped (domain/citations.ts).
 */
export const CitationSchema = z.object({
  marketId: z.string().min(1).optional(),
  regionId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  period: MonthSchema.optional(),
  /** The model's own wording for what it cites. */
  label: z.string().min(1).optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const StreamEventSchema = z.discriminatedUnion("type", [
  /** `value` keeps its trailing whitespace: the values concatenate to the answer exactly. */
  z.object({ type: z.literal("token"), value: z.string() }),
  z.object({
    type: z.literal("done"),
    kind: AnswerKindSchema,
    citations: z.array(CitationSchema),
    confidence: ConfidenceSchema,
  }),
  /** Sent instead of any further tokens when the answer fails. */
  z.object({ type: z.literal("error"), message: z.string().min(1) }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;
export type DoneEvent = Extract<StreamEvent, { type: "done" }>;

export const ChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Fixtures -----------------------------------------------------------------

export const FixtureSchema = z
  .object({
    id: z.string().min(1),
    /** Matched as case-insensitive substrings of the question; the first fixture to match wins. */
    keywords: z.array(z.string().min(1)).optional(),
    kind: AnswerKindSchema,
    answer: z.object({
      text: z.string(),
      citations: z.array(CitationSchema),
      confidence: ConfidenceSchema,
    }),
    /** The failure message an `error` fixture sends. */
    error: z.string().min(1).optional(),
  })
  .refine(
    (fixture) => fixture.kind === "error" || fixture.answer.text.length > 0,
    "Only an error fixture may have no answer text",
  );
export type Fixture = z.infer<typeof FixtureSchema>;

export const FixturesSchema = z
  .object({
    note: z.string().optional(),
    /** The answer when no fixture's keywords match. */
    default: FixtureSchema,
    fixtures: z.array(FixtureSchema),
  })
  .refine(
    ({ default: fallback, fixtures }) =>
      new Set([fallback.id, ...fixtures.map((f) => f.id)]).size ===
      fixtures.length + 1,
    "Fixture ids must be unique",
  );
export type Fixtures = z.infer<typeof FixturesSchema>;
