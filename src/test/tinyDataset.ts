import { z } from "zod";
import { DatasetSchema, type Dataset, type Point } from "@/domain/schema";

/**
 * Hand-written test datasets stay short: a market's `iso2` defaults to its id in capitals, and
 * its monthly market size can be written on each product's points instead, as that product's
 * part of the category. The parts are summed per month into the market's `marketSize`. Then the
 * real DatasetSchema validates it, so every test dataset is one the app could load.
 */
const TinyPointSchema = z.looseObject({
  period: z.string(),
  marketSize: z.number().optional(),
});

const TinyInputSchema = z.looseObject({
  markets: z.array(
    z.looseObject({
      id: z.string(),
      iso2: z.string().optional(),
      series: z.record(z.string(), z.array(TinyPointSchema)),
      marketSize: z.record(z.string(), z.number()).optional(),
    }),
  ),
});

export function tinyDataset(input: unknown): Dataset {
  const tiny = TinyInputSchema.parse(input);
  return DatasetSchema.parse({
    ...tiny,
    markets: tiny.markets.map((market) => {
      const marketSize: Record<string, number> = { ...market.marketSize };
      for (const points of Object.values(market.series)) {
        for (const { period, marketSize: part } of points) {
          if (part !== undefined) {
            marketSize[period] = (marketSize[period] ?? 0) + part;
          }
        }
      }
      return {
        ...market,
        iso2: market.iso2 ?? market.id.toUpperCase(),
        marketSize,
      };
    }),
  });
}

/** A point in a tiny dataset: a Point, plus this product's part of the market size. */
export type TinyPoint = Point & { marketSize?: number };
