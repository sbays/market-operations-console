import { describe, expect, it } from "vitest";
import { DatasetSchema, type Point } from "./schema";
import {
  childrenOf,
  confidenceBand,
  expandPeriod,
  latestQuarter,
  statusCounts,
  statusForAttainment,
  statusOf,
  topMovers,
  valueAt,
} from "./selectors";

/*
 * A tiny dataset whose answers can be worked out by hand.
 * Every month (Jan–Jun 2026) is identical except DE/beacon in March.
 *
 *            actual  forecast  priorYear  marketSize  units
 * DE/atlas     100      100        80        1000       10
 * DE/beacon     50      100        50         500        5   (March: actual 20)
 * US/atlas     200      200       200        2000       20
 * US/beacon    100      100       100        1000       10
 */
const months = [
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
];

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

describe("expandPeriod", () => {
  it("expands a quarter to its months", () => {
    expect(expandPeriod(dataset, "2026-Q1")).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("keeps a month as itself and drops periods outside the data", () => {
    expect(expandPeriod(dataset, "2026-02")).toEqual(["2026-02"]);
    expect(expandPeriod(dataset, "2025-12")).toEqual([]);
    expect(expandPeriod(dataset, "2026-Q3")).toEqual([]);
  });
});

describe("valueAt: revenue", () => {
  it("sums products into their market", () => {
    // 100 + 50
    expect(valueAt(dataset, germany, "2026-01", "revenue")).toBe(150);
    // 100 + 20 (the March dip)
    expect(valueAt(dataset, germany, "2026-03", "revenue")).toBe(120);
  });

  it("sums a quarter's months", () => {
    // 150 + 150 + 120
    expect(valueAt(dataset, germany, "2026-Q1", "revenue")).toBe(420);
  });

  it("rolls markets up into regions and the portfolio", () => {
    expect(
      valueAt(dataset, { level: "region", id: "na" }, "2026-01", "revenue"),
    ).toBe(300);
    // 150 + 300
    expect(valueAt(dataset, { level: "portfolio" }, "2026-01", "revenue")).toBe(
      450,
    );
  });

  it("reads a single product in a market", () => {
    expect(
      valueAt(
        dataset,
        { level: "product", marketId: "DE", id: "beacon" },
        "2026-03",
        "revenue",
      ),
    ).toBe(20);
  });

  it("returns undefined for entities or periods outside the data", () => {
    expect(
      valueAt(dataset, { level: "market", id: "FR" }, "2026-01", "revenue"),
    ).toBeUndefined();
    expect(valueAt(dataset, germany, "2025-12", "revenue")).toBeUndefined();
  });
});

describe("valueAt: derived metrics", () => {
  it("reads units and forecast as sums", () => {
    expect(valueAt(dataset, germany, "2026-01", "units")).toBe(15);
    expect(valueAt(dataset, germany, "2026-01", "forecast")).toBe(200);
  });

  it("computes attainment as actual over forecast", () => {
    // 150 / 200
    expect(valueAt(dataset, germany, "2026-01", "attainment")).toBe(0.75);
    // 420 / 600 over Q1
    expect(valueAt(dataset, germany, "2026-Q1", "attainment")).toBe(0.7);
    // 450 / 500
    expect(
      valueAt(dataset, { level: "portfolio" }, "2026-01", "attainment"),
    ).toBe(0.9);
  });

  it("computes growth against the prior year", () => {
    // 150 / 130 - 1
    expect(valueAt(dataset, germany, "2026-01", "growth")).toBeCloseTo(
      0.153846,
      5,
    );
    expect(
      valueAt(dataset, { level: "region", id: "na" }, "2026-01", "growth"),
    ).toBe(0);
  });

  it("computes share from summed revenue and market size", () => {
    // 150 / 1500
    expect(valueAt(dataset, germany, "2026-01", "share")).toBe(0.1);
    // 450 / 4500
    expect(valueAt(dataset, { level: "portfolio" }, "2026-01", "share")).toBe(
      0.1,
    );
  });
});

describe("status", () => {
  it("is on-track from 98% attainment, at-risk from 92%, off-track below", () => {
    expect(statusForAttainment(1.05)).toBe("on-track");
    expect(statusForAttainment(0.98)).toBe("on-track");
    expect(statusForAttainment(0.9799)).toBe("at-risk");
    expect(statusForAttainment(0.92)).toBe("at-risk");
    expect(statusForAttainment(0.9199)).toBe("off-track");
  });

  it("judges an entity on its attainment over a quarter", () => {
    // DE Q1: 420 / 600 = 70%
    expect(statusOf(dataset, germany, "2026-Q1")).toBe("off-track");
    // US Q2: 900 / 900 = 100%
    expect(statusOf(dataset, { level: "market", id: "US" }, "2026-Q2")).toBe(
      "on-track",
    );
  });

  it("counts markets by status", () => {
    expect(statusCounts(dataset, "2026-Q2")).toEqual({
      "on-track": 1,
      "at-risk": 0,
      "off-track": 1,
    });
  });
});

describe("latestQuarter", () => {
  it("is the last quarter the data fully covers", () => {
    expect(latestQuarter(dataset)).toBe("2026-Q2");
    expect(latestQuarter({ ...dataset, periods: months.slice(0, 5) })).toBe(
      "2026-Q1",
    );
  });
});

describe("childrenOf", () => {
  it("walks the hierarchy one level down", () => {
    expect(childrenOf(dataset, { level: "portfolio" })).toEqual([
      { level: "region", id: "eu" },
      { level: "region", id: "na" },
    ]);
    expect(childrenOf(dataset, { level: "region", id: "eu" })).toEqual([
      { level: "market", id: "DE" },
    ]);
    expect(childrenOf(dataset, germany)).toEqual([
      { level: "product", marketId: "DE", id: "atlas" },
      { level: "product", marketId: "DE", id: "beacon" },
    ]);
    expect(
      childrenOf(dataset, { level: "product", marketId: "DE", id: "atlas" }),
    ).toEqual([]);
  });
});

describe("topMovers", () => {
  it("ranks markets by growth against the prior year, both ways", () => {
    // Jan: DE +15.4%, US 0%
    const movers = topMovers(dataset, "2026-01", 1);
    expect(movers.up.map((m) => m.ref)).toEqual([germany]);
    expect(movers.up[0]?.growth).toBeCloseTo(0.153846, 5);
    expect(movers.down.map((m) => m.ref)).toEqual([
      { level: "market", id: "US" },
    ]);
  });
});

describe("confidenceBand", () => {
  it("is high from 0.75, medium from 0.5, low below", () => {
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(0.75)).toBe("high");
    expect(confidenceBand(0.7499)).toBe("medium");
    expect(confidenceBand(0.5)).toBe("medium");
    expect(confidenceBand(0.4999)).toBe("low");
  });
});
