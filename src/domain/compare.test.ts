import { describe, expect, it } from "vitest";
import { MAX_COMPARE, comparedRefs, toggleCompared } from "./compare";
import type { Dataset, EntityRef } from "./schema";

// Europe has five markets, one more than the radar compares.
const dataset: Dataset = {
  currency: "USD",
  periods: ["2026-07"],
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [
    { id: "atlas", name: "Atlas" },
    { id: "beacon", name: "Beacon" },
  ],
  markets: [
    { id: "DE", name: "Germany", regionId: "eu", series: {} },
    { id: "FR", name: "France", regionId: "eu", series: {} },
    { id: "GB", name: "United Kingdom", regionId: "eu", series: {} },
    { id: "IT", name: "Italy", regionId: "eu", series: {} },
    { id: "ES", name: "Spain", regionId: "eu", series: {} },
    { id: "US", name: "United States", regionId: "na", series: {} },
  ],
  anomalies: [],
};

const europe: EntityRef = { level: "region", id: "eu" };
const market = (id: string): EntityRef => ({ level: "market", id });
const ids = (refs: EntityRef[]) =>
  refs.map((ref) => (ref.level === "portfolio" ? "" : ref.id));

describe("comparedRefs", () => {
  it("compares the first children when the URL names none", () => {
    expect(MAX_COMPARE).toBe(4);
    expect(ids(comparedRefs(dataset, europe, []))).toEqual([
      "DE",
      "FR",
      "GB",
      "IT",
    ]);
  });

  it("compares the children the URL names, in URL order", () => {
    expect(ids(comparedRefs(dataset, europe, ["eu.ES", "eu.DE"]))).toEqual([
      "ES",
      "DE",
    ]);
  });

  it("ignores paths that aren't children of the selection", () => {
    // After a drill into Germany, the markets ticked at Europe no longer apply.
    const germany = market("DE");
    expect(ids(comparedRefs(dataset, germany, ["eu.DE", "eu.FR"]))).toEqual([
      "atlas",
      "beacon",
    ]);
    expect(
      ids(comparedRefs(dataset, europe, ["eu.XX", "", "na.US", "eu.FR"])),
    ).toEqual(["FR"]);
  });

  it("counts a repeated path once", () => {
    expect(ids(comparedRefs(dataset, europe, ["eu.FR", "eu.FR"]))).toEqual([
      "FR",
    ]);
  });

  it("keeps at most four", () => {
    const all = ["eu.DE", "eu.FR", "eu.GB", "eu.IT", "eu.ES"];
    expect(comparedRefs(dataset, europe, all)).toHaveLength(MAX_COMPARE);
  });

  it("compares nothing below a product", () => {
    const product: EntityRef = {
      level: "product",
      marketId: "DE",
      id: "atlas",
    };
    expect(comparedRefs(dataset, product, [])).toEqual([]);
  });
});

describe("toggleCompared", () => {
  const defaults = comparedRefs(dataset, europe, []);

  it("removes a compared entity, keeping the rest of what is shown", () => {
    // Unticking France from the defaults writes the other three, not an empty list.
    expect(toggleCompared(dataset, defaults, market("FR"))).toEqual([
      "eu.DE",
      "eu.GB",
      "eu.IT",
    ]);
  });

  it("adds an entity when there is room", () => {
    const two = comparedRefs(dataset, europe, ["eu.DE", "eu.FR"]);
    expect(toggleCompared(dataset, two, market("ES"))).toEqual([
      "eu.DE",
      "eu.FR",
      "eu.ES",
    ]);
  });

  it("ignores an addition past the limit", () => {
    expect(toggleCompared(dataset, defaults, market("ES"))).toEqual([
      "eu.DE",
      "eu.FR",
      "eu.GB",
      "eu.IT",
    ]);
  });

  it("writes nothing when the last entity is removed", () => {
    const one = comparedRefs(dataset, europe, ["eu.FR"]);
    expect(toggleCompared(dataset, one, market("FR"))).toEqual([]);
  });
});
