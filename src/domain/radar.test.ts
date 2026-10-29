import { describe, expect, it } from "vitest";
import { DatasetSchema } from "./schema";
import { radarAxes, radarSummary, RADAR_METRICS } from "./radar";

/*
 * The same tiny dataset as selectors.test.ts, so the expected values can be worked out by hand.
 * Q1 2026 (Jan to Mar) totals, with March DE/beacon actual at 20 instead of 50:
 *
 *            revenue  units  forecast  priorYear  marketSize
 * DE         420      45     600       390        4500
 * US         900      90     900       900        9000
 *
 * DE growth = 420 / 390 - 1, DE attainment = 420 / 600, DE share = 420 / 4500.
 * US growth = 0, US attainment = 1, US share = 900 / 9000.
 */
const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
] as const;

const input = {
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
        atlas: months.map((period) => ({
          period,
          actual: 100,
          forecast: 100,
          priorYear: 80,
          marketSize: 1000,
          units: 10,
        })),
        beacon: months.map((period) => ({
          period,
          actual: period === "2026-03" ? 20 : 50,
          forecast: 100,
          priorYear: 50,
          marketSize: 500,
          units: 5,
        })),
      },
    },
    {
      id: "US",
      name: "United States",
      regionId: "na",
      series: {
        atlas: months.map((period) => ({
          period,
          actual: 200,
          forecast: 200,
          priorYear: 200,
          marketSize: 2000,
          units: 20,
        })),
        beacon: months.map((period) => ({
          period,
          actual: 100,
          forecast: 100,
          priorYear: 100,
          marketSize: 1000,
          units: 10,
        })),
      },
    },
  ],
  anomalies: [],
};

const dataset = DatasetSchema.parse(input);
const germany = { level: "market", id: "DE" } as const;
const unitedStates = { level: "market", id: "US" } as const;

describe("radarAxes", () => {
  it("names the five metrics in display order", () => {
    expect(RADAR_METRICS).toEqual([
      "revenue",
      "units",
      "growth",
      "attainment",
      "share",
    ]);
  });

  it("returns one series per ref, in the order given", () => {
    const series = radarAxes(dataset, [unitedStates, germany], "2026-Q1");

    expect(series.map((s) => s.ref)).toEqual([unitedStates, germany]);
  });

  it("keeps raw values and scales each axis to the largest entity", () => {
    const [de, us] = radarAxes(dataset, [germany, unitedStates], "2026-Q1");

    expect(de?.values.revenue.raw).toBe(420);
    expect(us?.values.revenue.raw).toBe(900);
    expect(de?.values.revenue.scaled).toBeCloseTo(420 / 900);
    expect(us?.values.revenue.scaled).toBe(1);

    expect(de?.values.units.scaled).toBeCloseTo(45 / 90);
    expect(us?.values.units.scaled).toBe(1);

    expect(de?.values.attainment.raw).toBeCloseTo(0.7);
    expect(de?.values.attainment.scaled).toBeCloseTo(0.7);
    expect(us?.values.attainment.scaled).toBe(1);

    expect(de?.values.share.scaled).toBeCloseTo(420 / 4500 / (900 / 9000));
    expect(us?.values.share.scaled).toBe(1);
  });

  it("maps growth so that zero sits at the middle of the axis", () => {
    const [de, us] = radarAxes(dataset, [germany, unitedStates], "2026-Q1");

    // DE has the largest growth in magnitude, so it reaches the outer ring.
    expect(de?.values.growth.raw).toBeCloseTo(30 / 390);
    expect(de?.values.growth.scaled).toBe(1);
    expect(us?.values.growth.raw).toBe(0);
    expect(us?.values.growth.scaled).toBe(0.5);
  });

  it("scores an entity the data doesn't contain as no data at zero", () => {
    const unknown = { level: "market", id: "XX" } as const;
    const [de, missing] = radarAxes(dataset, [germany, unknown], "2026-Q1");

    expect(missing?.values.revenue).toEqual({ raw: undefined, scaled: 0 });
    expect(missing?.values.growth).toEqual({ raw: undefined, scaled: 0 });
    // The largest known entity still sets the scale.
    expect(de?.values.revenue.scaled).toBeCloseTo(420 / 420);
  });

  it("scales an axis whose largest value is zero to zero for every entity", () => {
    const unitless = DatasetSchema.parse({
      ...input,
      markets: input.markets.map((market) => ({
        ...market,
        series: Object.fromEntries(
          Object.entries(market.series).map(([id, points]) => [
            id,
            points.map((point) => ({ ...point, units: 0 })),
          ]),
        ),
      })),
    });
    const [de, us] = radarAxes(unitless, [germany, unitedStates], "2026-Q1");

    expect(de?.values.units).toEqual({ raw: 0, scaled: 0 });
    expect(us?.values.units).toEqual({ raw: 0, scaled: 0 });
  });

  it("returns undefined raw values for a period outside the data", () => {
    const [de] = radarAxes(dataset, [germany], "2025-Q4");

    expect(de?.values.revenue).toEqual({ raw: undefined, scaled: 0 });
  });
});

describe("radarSummary", () => {
  it("names the entities, period, metrics and the revenue leader in words", () => {
    const series = radarAxes(dataset, [germany, unitedStates], "2026-Q1");

    expect(radarSummary(dataset, series, "2026-Q1")).toBe(
      "Comparing Germany and United States in Q1 2026 on revenue, units, growth vs prior year, forecast attainment and market share. United States leads on revenue.",
    );
  });

  it("omits the leader sentence when no entity has revenue", () => {
    const unknown = { level: "market", id: "XX" } as const;
    const series = radarAxes(dataset, [unknown], "2026-Q1");

    expect(radarSummary(dataset, series, "2026-Q1")).not.toMatch(/leads/);
  });
});
