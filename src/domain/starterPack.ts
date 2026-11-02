/**
 * The starter pack's data.json (src/pack/CONTRACT.md) as it arrives, and the one translation
 * into the app's Dataset. Pure, so the translation is tested without the server-only loader.
 *
 * What the translation decides:
 * - The fact table becomes one series per market and product; growth, attainment and status
 *   are recomputed from it by selectors, so the precomputed `kpis` are not read for them.
 * - `kpis.sharePct` is the only share the pack states, for its latest month. It is stored as
 *   that month's market size (revenue ÷ share), so share rolls up to regions like every other
 *   ratio. Other months have no share.
 * - A market's `kpis.anomalies` become revenue anomalies on that market: the pack's notes
 *   describe revenue, and the trend chart is where they show.
 */
import { z } from "zod";
import { MonthSchema } from "./period";
import {
  DatasetSchema,
  type Anomaly,
  type Dataset,
  type Market,
  type Point,
} from "./schema";

const amount = z.number().nonnegative();

export const PackStatusSchema = z.enum(["on_track", "at_risk", "off_track"]);

const PackMarketSchema = z.object({
  id: z.string(),
  name: z.string(),
  iso3: z.string().regex(/^[A-Z]{3}$/),
  iso2: z.string().regex(/^[A-Z]{2}$/),
  regionId: z.string(),
  kpis: z.object({
    revenue: amount,
    growthPct: z.number(),
    sharePct: z.number().positive().max(100),
    forecastAttainmentPct: z.number(),
    status: PackStatusSchema,
    anomalies: z.array(
      z.object({
        period: MonthSchema,
        type: z.string().min(1),
        note: z.string().min(1),
      }),
    ),
  }),
});

const PackRowSchema = z.object({
  marketId: z.string(),
  productId: z.string(),
  period: MonthSchema,
  actual: amount,
  forecast: amount,
  units: amount,
  priorYear: amount,
});

export const StarterPackSchema = z
  .object({
    meta: z.object({
      currency: z.literal("USD"),
      periods: z.array(MonthSchema).min(1),
      latestPeriod: MonthSchema,
      generatedAt: z.string(),
    }),
    regions: z.array(z.object({ id: z.string(), name: z.string() })),
    products: z.array(z.object({ id: z.string(), name: z.string() })),
    markets: z.array(PackMarketSchema),
    series: z.array(PackRowSchema),
  })
  .refine(
    (pack) => pack.meta.periods.at(-1) === pack.meta.latestPeriod,
    "meta.latestPeriod must be the last of meta.periods",
  );
export type StarterPack = z.infer<typeof StarterPackSchema>;

/**
 * The pack as the app's Dataset, validated by DatasetSchema on the way out, so a missing row,
 * a duplicate or an unknown id fails here rather than in a chart.
 */
export function datasetFromPack(raw: unknown): Dataset {
  const pack = StarterPackSchema.parse(raw);
  const { periods, latestPeriod } = pack.meta;
  const position = new Map(periods.map((period, index) => [period, index]));

  const rows = new Map<string, Map<string, Point[]>>();
  for (const { marketId, productId, ...point } of pack.series) {
    const byProduct = rows.get(marketId) ?? new Map<string, Point[]>();
    rows.set(marketId, byProduct);
    const series = byProduct.get(productId) ?? [];
    byProduct.set(productId, series);
    series.push(point);
  }

  const markets: Market[] = pack.markets.map((market) => {
    const byProduct = rows.get(market.id) ?? new Map<string, Point[]>();
    const series = Object.fromEntries(
      [...byProduct].map(([productId, points]) => [
        productId,
        points.toSorted(
          (a, b) =>
            (position.get(a.period) ?? 0) - (position.get(b.period) ?? 0),
        ),
      ]),
    );
    const latestRevenue = [...byProduct.values()]
      .flat()
      .filter((point) => point.period === latestPeriod)
      .reduce((sum, point) => sum + point.actual, 0);
    return {
      id: market.id,
      iso2: market.iso2,
      name: market.name,
      regionId: market.regionId,
      series,
      marketSize: {
        [latestPeriod]: latestRevenue / (market.kpis.sharePct / 100),
      },
    };
  });

  const anomalies: Anomaly[] = pack.markets.flatMap((market) =>
    market.kpis.anomalies.map(({ period, note }) => ({
      ref: { level: "market", id: market.id },
      period,
      metric: "revenue",
      note,
    })),
  );

  return DatasetSchema.parse({
    currency: pack.meta.currency,
    periods,
    regions: pack.regions,
    products: pack.products,
    markets,
    anomalies,
  });
}
