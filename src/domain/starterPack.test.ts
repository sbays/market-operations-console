import { describe, expect, it } from "vitest";
import { valueAt } from "./selectors";
import { datasetFromPack } from "./starterPack";

const row = (
  marketId: string,
  productId: string,
  period: string,
  actual: number,
) => ({
  marketId,
  productId,
  period,
  actual,
  forecast: 100,
  units: 1,
  priorYear: 90,
});

const kpis = {
  revenue: 0,
  growthPct: 0,
  sharePct: 25,
  forecastAttainmentPct: 0,
  status: "on_track",
  anomalies: [],
};

/** A two-month, one-product pack in the starter pack's shape. */
const pack = {
  meta: {
    currency: "USD",
    periods: ["2026-04", "2026-05"],
    latestPeriod: "2026-05",
    generatedAt: "2026-06-09",
  },
  regions: [{ id: "eu", name: "Europe" }],
  products: [{ id: "veltrix", name: "Veltrix" }],
  markets: [
    {
      id: "de",
      name: "Germany",
      iso3: "DEU",
      iso2: "DE",
      regionId: "eu",
      kpis: {
        ...kpis,
        anomalies: [
          { period: "2026-04", type: "dip", note: "Revenue fell 27%." },
        ],
      },
    },
  ],
  // Out of order on purpose: the fact table has no order to rely on.
  series: [
    row("de", "veltrix", "2026-05", 200),
    row("de", "veltrix", "2026-04", 150),
  ],
};

describe("datasetFromPack", () => {
  it("turns the fact table into one series per market and product, in period order", () => {
    const dataset = datasetFromPack(pack);
    expect(dataset.markets[0]?.series.veltrix?.map((p) => p.period)).toEqual([
      "2026-04",
      "2026-05",
    ]);
    expect(dataset.markets[0]).toMatchObject({ id: "de", iso2: "DE" });
  });

  it("stores the stated share as the latest month's market size, so share comes back out", () => {
    const dataset = datasetFromPack(pack);
    // 200 of revenue at a 25% share: a market of 800.
    expect(dataset.markets[0]?.marketSize).toEqual({ "2026-05": 800 });
    expect(
      valueAt(dataset, { level: "market", id: "de" }, "2026-05", "share"),
    ).toBe(0.25);
    expect(
      valueAt(dataset, { level: "market", id: "de" }, "2026-04", "share"),
    ).toBeUndefined();
  });

  it("keeps a market's anomalies as revenue anomalies on that market", () => {
    expect(datasetFromPack(pack).anomalies).toEqual([
      {
        ref: { level: "market", id: "de" },
        period: "2026-04",
        metric: "revenue",
        note: "Revenue fell 27%.",
      },
    ]);
  });

  it("rejects a pack missing a row", () => {
    expect(() =>
      datasetFromPack({ ...pack, series: pack.series.slice(0, 1) }),
    ).toThrow(/does not match the dataset periods/);
  });

  it("rejects a row for a market or product the pack doesn't list", () => {
    expect(() =>
      datasetFromPack({
        ...pack,
        series: [...pack.series, row("de", "nuvora", "2026-04", 1)],
      }),
    ).toThrow(/unknown product nuvora/);
  });

  it("rejects a row for a market the pack doesn't list, instead of dropping its revenue", () => {
    expect(() =>
      datasetFromPack({
        ...pack,
        series: [
          ...pack.series,
          row("xx", "veltrix", "2026-04", 1),
          row("xx", "veltrix", "2026-05", 1),
        ],
      }),
    ).toThrow(/unknown market xx/);
  });

  it("gives a market with no latest revenue no share, rather than failing", () => {
    const dataset = datasetFromPack({
      ...pack,
      series: [row("de", "veltrix", "2026-05", 0), pack.series[1]],
    });
    expect(dataset.markets[0]?.marketSize).toEqual({});
  });

  it("rejects a latest period that isn't the last month", () => {
    expect(() =>
      datasetFromPack({
        ...pack,
        meta: { ...pack.meta, latestPeriod: "2026-04" },
      }),
    ).toThrow(/latestPeriod/);
  });

  it("rejects a status outside the pack's three", () => {
    const market = pack.markets[0];
    expect(() =>
      datasetFromPack({
        ...pack,
        markets: [{ ...market, kpis: { ...kpis, status: "on-track" } }],
      }),
    ).toThrow();
  });
});
