import { describe, expect, it } from "vitest";
import { DatasetSchema, type Point } from "./schema";
import { heatColour, heatmapRows, heatmapSummary } from "./heatmap";

/*
 * The same hand-built dataset as selectors.test.ts (copied, not imported, so the two can
 * change independently). Every month is identical except DE/beacon in March (actual 20).
 *
 *            actual  forecast
 * DE/atlas     100      100
 * DE/beacon     50      100   (March: actual 20)
 * US/atlas     200      200
 * US/beacon    100      100
 */
const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
] as const;

function series(
  values: Omit<Point, "period">,
  overrides: Record<string, Partial<Point>> = {},
): Point[] {
  return months.map((period) => ({
    period,
    ...values,
    ...overrides[period],
  }));
}

const dataset = DatasetSchema.parse({
  currency: "USD",
  periods: months,
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [
    { id: "atlas", name: "Atlas" },
    { id: "beacon", name: "Beacon" },
  ],
  markets: [
    {
      id: "DE",
      name: "Germany",
      regionId: "eu",
      series: {
        atlas: series({
          actual: 100,
          forecast: 100,
          priorYear: 80,
          marketSize: 1000,
          units: 10,
        }),
        beacon: series(
          {
            actual: 50,
            forecast: 100,
            priorYear: 50,
            marketSize: 500,
            units: 5,
          },
          { "2026-03": { actual: 20 } },
        ),
      },
    },
    {
      id: "US",
      name: "United States",
      regionId: "na",
      series: {
        atlas: series({
          actual: 200,
          forecast: 200,
          priorYear: 200,
          marketSize: 2000,
          units: 20,
        }),
        beacon: series({
          actual: 100,
          forecast: 100,
          priorYear: 100,
          marketSize: 1000,
          units: 10,
        }),
      },
    },
  ],
  anomalies: [],
});

const germany = { level: "market", id: "DE" } as const;
const atlasInGermany = {
  level: "product",
  marketId: "DE",
  id: "atlas",
} as const;
const beaconInGermany = {
  level: "product",
  marketId: "DE",
  id: "beacon",
} as const;

describe("heatmapRows", () => {
  it("has one row per child and one cell per dataset month", () => {
    const rows = heatmapRows(dataset, germany);

    expect(rows.map((row) => row.ref)).toEqual([
      atlasInGermany,
      beaconInGermany,
    ]);
    expect(rows.every((row) => row.cells.length === months.length)).toBe(true);
    expect(rows[0]?.cells.map((cell) => cell.period)).toEqual([...months]);
  });

  it("reads attainment per child and month", () => {
    const [atlas, beacon] = heatmapRows(dataset, germany);

    // Atlas holds forecast every month; beacon's March dip is 20 / 100.
    expect(atlas?.cells[2]).toEqual({ period: "2026-03", attainment: 1 });
    expect(beacon?.cells[2]).toEqual({ period: "2026-03", attainment: 0.2 });
    expect(beacon?.cells[0]).toEqual({ period: "2026-01", attainment: 0.5 });
  });

  it("rolls children up when the rows are regions", () => {
    const rows = heatmapRows(dataset, { level: "portfolio" });
    const europe = rows.find(
      (row) => row.ref.level === "region" && row.ref.id === "eu",
    );

    // Germany in March: (100 + 20) / (100 + 100) = 0.6, as the selectors compute it.
    expect(europe).toBeDefined();
    expect(rows.map((row) => row.ref)).toEqual([
      { level: "region", id: "eu" },
      { level: "region", id: "na" },
    ]);
    expect(europe?.cells[2]?.attainment).toBe(0.6);
  });

  it("returns no rows below a product", () => {
    expect(heatmapRows(dataset, atlasInGermany)).toEqual([]);
  });
});

describe("heatColour", () => {
  it("is the muted token when the data has no attainment", () => {
    expect(heatColour(undefined)).toBe("var(--muted)");
  });

  it("is the midpoint token exactly at 100%", () => {
    expect(heatColour(1)).toBe("var(--diverging-midpoint)");
  });

  it("is the full negative token at 80% and below", () => {
    expect(heatColour(0.8)).toBe("var(--diverging-negative)");
    expect(heatColour(0.2)).toBe("var(--diverging-negative)");
  });

  it("is the full positive token at 120% and above", () => {
    expect(heatColour(1.2)).toBe("var(--diverging-positive)");
    expect(heatColour(3)).toBe("var(--diverging-positive)");
  });

  it("mixes halfway at 90% and 110%", () => {
    expect(heatColour(0.9)).toBe(
      "color-mix(in oklch, var(--diverging-negative) 50%, var(--diverging-midpoint))",
    );
    expect(heatColour(1.1)).toBe(
      "color-mix(in oklch, var(--diverging-positive) 50%, var(--diverging-midpoint))",
    );
  });

  it("only ever names tokens, never a literal colour", () => {
    for (const value of [0.1, 0.45, 0.85, 0.99, 1.01, 1.15, 2]) {
      expect(heatColour(value)).not.toMatch(
        /#|oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\)/,
      );
    }
  });
});

describe("heatmapSummary", () => {
  it("names the lowest cell in the grid", () => {
    expect(heatmapSummary(dataset, heatmapRows(dataset, germany))).toBe(
      "Lowest: Beacon in Germany, Mar 2026, at 20.0% of forecast.",
    );
  });

  it("says so when no cell has attainment", () => {
    expect(heatmapSummary(dataset, [])).toBe(
      "No attainment data for this selection.",
    );
  });
});
