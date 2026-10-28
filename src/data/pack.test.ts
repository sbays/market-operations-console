import { describe, expect, it } from "vitest";
import type { EntityRef } from "@/domain/schema";
import { latestQuarter, statusOf, valueAt } from "@/domain/selectors";
import { loadDataset } from "./pack";

const dataset = loadDataset();

const market = (id: string): EntityRef => ({ level: "market", id });
const product = (marketId: string, id: string): EntityRef => ({
  level: "product",
  marketId,
  id,
});

describe("generated dataset", () => {
  it("covers 24 months, 4 regions, 12 markets and 5 products", () => {
    expect(dataset.periods[0]).toBe("2024-10");
    expect(dataset.periods.at(-1)).toBe("2026-09");
    expect(dataset.periods).toHaveLength(24);
    expect(dataset.regions.map((r) => r.id)).toEqual([
      "na",
      "eu",
      "apac",
      "latam",
    ]);
    expect(dataset.markets.map((m) => m.id)).toEqual([
      "US",
      "CA",
      "DE",
      "FR",
      "GB",
      "IT",
      "ES",
      "JP",
      "AU",
      "IN",
      "BR",
      "MX",
    ]);
    expect(dataset.products).toHaveLength(5);
  });
});

describe("story: why did Germany's revenue dip in March 2026?", () => {
  it("Germany missed forecast by about a fifth in March", () => {
    const attainment = valueAt(dataset, market("DE"), "2026-03", "attainment");
    expect(attainment).toBeGreaterThan(0.78);
    expect(attainment).toBeLessThan(0.85);
  });

  it("the miss is concentrated in Beacon", () => {
    expect(
      valueAt(dataset, product("DE", "beacon"), "2026-03", "attainment"),
    ).toBeLessThan(0.6);
    for (const other of ["atlas", "cirrus", "delta", "ember"]) {
      expect(
        valueAt(dataset, product("DE", other), "2026-03", "attainment"),
      ).toBeGreaterThan(0.9);
    }
  });

  it("Germany is back on forecast by May", () => {
    expect(
      valueAt(dataset, market("DE"), "2026-05", "attainment"),
    ).toBeGreaterThanOrEqual(0.97);
  });

  it("an anomaly explains the March dip", () => {
    expect(dataset.anomalies).toContainEqual(
      expect.objectContaining({
        ref: product("DE", "beacon"),
        period: "2026-03",
        metric: "revenue",
      }),
    );
  });
});

describe("story: which markets are at risk this quarter, and why?", () => {
  it("this quarter is Q3 2026, the last complete quarter", () => {
    expect(latestQuarter(dataset)).toBe("2026-Q3");
  });

  it("Brazil is off-track; Germany, Japan and India are at risk; the rest are on track", () => {
    const statuses = Object.fromEntries(
      dataset.markets.map((m) => [
        m.id,
        statusOf(dataset, market(m.id), "2026-Q3"),
      ]),
    );
    expect(statuses).toEqual({
      US: "on-track",
      CA: "on-track",
      DE: "at-risk",
      FR: "on-track",
      GB: "on-track",
      IT: "on-track",
      ES: "on-track",
      JP: "at-risk",
      AU: "on-track",
      IN: "at-risk",
      BR: "off-track",
      MX: "on-track",
    });
  });
});

describe("story: compare APAC and Europe on growth and forecast attainment", () => {
  const apac: EntityRef = { level: "region", id: "apac" };
  const europe: EntityRef = { level: "region", id: "eu" };

  it("APAC grows much faster than Europe", () => {
    expect(valueAt(dataset, apac, "2026-Q3", "growth")).toBeGreaterThan(0.09);
    const europeGrowth = valueAt(dataset, europe, "2026-Q3", "growth");
    expect(europeGrowth).toBeGreaterThan(0);
    expect(europeGrowth).toBeLessThan(0.04);
  });

  it("but APAC misses its forecast while Europe nearly meets it", () => {
    expect(valueAt(dataset, apac, "2026-Q3", "attainment")).toBeLessThan(0.96);
    expect(valueAt(dataset, europe, "2026-Q3", "attainment")).toBeGreaterThan(
      0.975,
    );
  });
});

describe("story: what's driving the portfolio's forecast miss?", () => {
  const lastTwoQuarters = ["2026-Q2", "2026-Q3"] as const;

  /** Forecast minus revenue for one product summed across every market. */
  function productShortfall(productId: string): number {
    let gap = 0;
    for (const m of dataset.markets) {
      for (const quarter of lastTwoQuarters) {
        const ref = product(m.id, productId);
        gap +=
          (valueAt(dataset, ref, quarter, "forecast") ?? 0) -
          (valueAt(dataset, ref, quarter, "revenue") ?? 0);
      }
    }
    return gap;
  }

  it("the portfolio has been at risk for two quarters running", () => {
    for (const quarter of lastTwoQuarters) {
      expect(statusOf(dataset, { level: "portfolio" }, quarter)).toBe(
        "at-risk",
      );
    }
  });

  it("Cirrus accounts for the largest shortfall of any product", () => {
    const shortfalls = dataset.products
      .map((p) => ({ id: p.id, gap: productShortfall(p.id) }))
      .sort((a, b) => b.gap - a.gap);
    expect(shortfalls[0]?.id).toBe("cirrus");
  });
});
