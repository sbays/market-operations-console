import { tinyDataset } from "@/test/tinyDataset";
import { describe, expect, it } from "vitest";
import { resolveCitation } from "./citations";

const months = ["2026-04", "2026-05"] as const;
const series = months.map((period) => ({
  period,
  actual: 100,
  forecast: 100,
  priorYear: 90,
  units: 1,
}));

const dataset = tinyDataset({
  currency: "USD",
  periods: months,
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [{ id: "veltrix", name: "Veltrix" }],
  markets: [
    { id: "de", name: "Germany", regionId: "eu", series: { veltrix: series } },
    {
      id: "us",
      name: "United States",
      regionId: "na",
      series: { veltrix: series },
    },
  ],
  anomalies: [],
});

describe("resolveCitation", () => {
  it("resolves the most specific entity a citation names", () => {
    expect(
      resolveCitation(dataset, {
        marketId: "de",
        productId: "veltrix",
        period: "2026-04",
      }),
    ).toEqual({
      ref: { level: "product", marketId: "de", id: "veltrix" },
      period: "2026-04",
    });
    expect(
      resolveCitation(dataset, { marketId: "de", period: "2026-04" }),
    ).toEqual({ ref: { level: "market", id: "de" }, period: "2026-04" });
    expect(
      resolveCitation(dataset, { regionId: "eu", period: "2026-05" }),
    ).toEqual({ ref: { level: "region", id: "eu" }, period: "2026-05" });
  });

  it("cites the latest month when the citation names none", () => {
    expect(resolveCitation(dataset, { marketId: "us" })).toEqual({
      ref: { level: "market", id: "us" },
      period: "2026-05",
    });
  });

  it("accepts a market cited with its own region, and rejects one cited with another", () => {
    expect(
      resolveCitation(dataset, { regionId: "eu", marketId: "de" }),
    ).toBeDefined();
    expect(
      resolveCitation(dataset, { regionId: "na", marketId: "de" }),
    ).toBeUndefined();
  });

  it("can't resolve what the data doesn't contain", () => {
    for (const citation of [
      {},
      { label: "Somewhere" },
      { marketId: "nz" },
      { regionId: "apac" },
      { productId: "veltrix" },
      { marketId: "de", productId: "nuvora" },
      { marketId: "de", period: "2027-01" },
    ] as const) {
      expect(resolveCitation(dataset, citation), JSON.stringify(citation)).toBe(
        undefined,
      );
    }
  });
});
