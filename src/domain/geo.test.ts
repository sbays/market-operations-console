import { geoContains } from "d3-geo";
import { describe, expect, it } from "vitest";
import worldTopology from "world-atlas/countries-110m.json";
import type { Dataset, EntityRef } from "./schema";
import {
  MARKET_GEO_IDS,
  WorldTopologySchema,
  countryOf,
  marketAnchor,
  marketLocation,
  marketsInSelection,
  worldProjection,
} from "./geo";

// A small hand-built dataset: the real pack is read in MarketMap.test.tsx, since domain/
// may not import the data layer.
const dataset: Dataset = {
  currency: "USD",
  periods: ["2026-07"],
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [{ id: "beacon", name: "Beacon" }],
  markets: [
    { id: "DE", name: "Germany", regionId: "eu", series: {} },
    { id: "FR", name: "France", regionId: "eu", series: {} },
    { id: "US", name: "United States", regionId: "na", series: {} },
  ],
  anomalies: [],
};

describe("MARKET_GEO_IDS", () => {
  it("resolves every mapped market to a country in the topology", () => {
    for (const marketId of Object.keys(MARKET_GEO_IDS)) {
      expect(countryOf(marketId), marketId).toBeDefined();
    }
  });

  it("uses the zero-padded numeric ids the topology writes", () => {
    expect(MARKET_GEO_IDS.DE).toBe("276");
    expect(MARKET_GEO_IDS.AU).toBe("036");
  });
});

describe("WorldTopologySchema", () => {
  it("accepts the bundled world-atlas countries file", () => {
    expect(WorldTopologySchema.safeParse(worldTopology).success).toBe(true);
  });

  it("rejects a document that is not a topology", () => {
    expect(
      WorldTopologySchema.safeParse({ type: "FeatureCollection" }).success,
    ).toBe(false);
  });
});

describe("marketsInSelection", () => {
  const idsOf = (ref: EntityRef) =>
    [...marketsInSelection(dataset, ref)].sort();

  it("covers every market at the portfolio", () => {
    expect(idsOf({ level: "portfolio" })).toEqual(["DE", "FR", "US"]);
  });

  it("covers a region's markets", () => {
    expect(idsOf({ level: "region", id: "eu" })).toEqual(["DE", "FR"]);
  });

  it("covers only the selected market", () => {
    expect(idsOf({ level: "market", id: "DE" })).toEqual(["DE"]);
  });

  it("covers the market a product belongs to", () => {
    expect(idsOf({ level: "product", marketId: "DE", id: "beacon" })).toEqual([
      "DE",
    ]);
  });
});

describe("marketAnchor", () => {
  it("places every mapped market inside the projected drawing box", () => {
    const size = { width: 800, height: 400 };
    const project = worldProjection(size);
    for (const marketId of Object.keys(MARKET_GEO_IDS)) {
      const anchor = marketAnchor(marketId, project);
      expect(anchor, marketId).toBeDefined();
      const [x, y] = anchor ?? [NaN, NaN];
      expect(x, marketId).toBeGreaterThanOrEqual(0);
      expect(x, marketId).toBeLessThanOrEqual(size.width);
      expect(y, marketId).toBeGreaterThanOrEqual(0);
      expect(y, marketId).toBeLessThanOrEqual(size.height);
    }
  });

  it("is the projected location of the market", () => {
    const project = worldProjection({ width: 800, height: 400 });
    const location = marketLocation("DE");
    expect(marketAnchor("DE", project)).toEqual(location && project(location));
  });
});

describe("marketLocation", () => {
  // A whole-country centroid lands at sea for countries in several parts (France with
  // French Guiana, Japan's islands), so the marker would sit off the country it names.
  it("falls inside its own country for every mapped market", () => {
    for (const marketId of Object.keys(MARKET_GEO_IDS)) {
      const country = countryOf(marketId);
      const location = marketLocation(marketId);
      expect(
        country && location && geoContains(country, location),
        marketId,
      ).toBe(true);
    }
  });

  it("is undefined for a market with no country", () => {
    expect(marketLocation("XX")).toBeUndefined();
  });
});
