import { z } from "zod";

// Identifiers --------------------------------------------------------------

export const RegionIdSchema = z.string().regex(/^[a-z]+$/);
/** ISO 3166-1 alpha-2, e.g. "DE". */
export const MarketIdSchema = z.string().regex(/^[A-Z]{2}$/);
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

// Periods ------------------------------------------------------------------

/** "2026-03" */
export const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
/** "2026-Q3" */
export const QuarterSchema = z.string().regex(/^\d{4}-Q[1-4]$/);
/** What a citation or selection can refer to: one month or one quarter. */
export const PeriodRefSchema = z.union([MonthSchema, QuarterSchema]);

export type Month = z.infer<typeof MonthSchema>;
export type Quarter = z.infer<typeof QuarterSchema>;
export type PeriodRef = z.infer<typeof PeriodRefSchema>;

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
  /** Total category revenue in the market, so share rolls up as Σactual / ΣmarketSize. */
  marketSize: amount,
});
export type Point = z.infer<typeof PointSchema>;

export const RegionSchema = z.object({ id: RegionIdSchema, name: z.string() });
export const ProductSchema = z.object({
  id: ProductIdSchema,
  name: z.string(),
});
export const MarketSchema = z.object({
  id: MarketIdSchema,
  name: z.string(),
  regionId: RegionIdSchema,
  series: z.record(ProductIdSchema, z.array(PointSchema)),
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

    for (const market of dataset.markets) {
      if (!regionIds.has(market.regionId)) {
        fail(`Market ${market.id} is in unknown region "${market.regionId}"`);
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

export const CitationSchema = z.object({
  /** Matches the inline marker [id] in the answer text. */
  id: z.number().int().positive(),
  ref: EntityRefSchema,
  period: PeriodRefSchema,
  metric: MetricSchema,
});
export type Citation = z.infer<typeof CitationSchema>;

const citationList = z
  .array(CitationSchema)
  .refine(
    (citations) =>
      new Set(citations.map((c) => c.id)).size === citations.length,
    "Citation ids must be unique",
  );

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), text: z.string() }),
  z.object({
    type: z.literal("final"),
    confidence: z.number().min(0).max(1),
    citations: citationList,
    uncertainty: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("abstain"),
    reason: z.string().min(1),
    coverage: z.object({ from: MonthSchema, to: MonthSchema }),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string().min(1),
    retryable: z.boolean(),
  }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const ChatRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Fixtures -----------------------------------------------------------------

/** How questions are compared for an exact fixture match: case- and spacing-insensitive. */
export function normaliseQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

export const FixtureResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("answer"),
    text: z.string().min(1),
    confidence: z.number().min(0).max(1),
    citations: citationList,
    uncertainty: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("abstention"),
    /** Optional lead-in streamed before the abstain event. */
    text: z.string().min(1).optional(),
    reason: z.string().min(1),
  }),
  z.object({
    kind: z.literal("error"),
    /** Partial answer streamed before the failure. */
    text: z.string().min(1),
    message: z.string().min(1),
  }),
]);

export const FixtureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  question: z.string().min(1),
  /** Shown as a suggested-question chip. */
  suggested: z.boolean(),
  response: FixtureResponseSchema,
});
export type Fixture = z.infer<typeof FixtureSchema>;

export const FixturesSchema = z
  .array(FixtureSchema)
  .refine(
    (fixtures) =>
      new Set(fixtures.map((f) => normaliseQuestion(f.question))).size ===
      fixtures.length,
    "Fixture questions must be unique after normalising",
  )
  .refine(
    (fixtures) => new Set(fixtures.map((f) => f.id)).size === fixtures.length,
    "Fixture ids must be unique",
  );
