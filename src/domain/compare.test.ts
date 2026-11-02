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
    { id: "veltrix", name: "Veltrix" },
    { id: "nuvora", name: "Nuvora" },
  ],
  markets: [
    {
      id: "de",
      iso2: "DE",
      name: "Germany",
      regionId: "eu",
      series: {},
      marketSize: {},
    },
    {
      id: "fr",
      iso2: "FR",
      name: "France",
      regionId: "eu",
      series: {},
      marketSize: {},
    },
    {
      id: "gb",
      iso2: "GB",
      name: "United Kingdom",
      regionId: "eu",
      series: {},
      marketSize: {},
    },
    {
      id: "it",
      iso2: "IT",
      name: "Italy",
      regionId: "eu",
      series: {},
      marketSize: {},
    },
    {
      id: "es",
      iso2: "ES",
      name: "Spain",
      regionId: "eu",
      series: {},
      marketSize: {},
    },
    {
      id: "us",
      iso2: "US",
      name: "United States",
      regionId: "na",
      series: {},
      marketSize: {},
    },
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
      "de",
      "fr",
      "gb",
      "it",
    ]);
  });

  it("compares the children the URL names, in URL order", () => {
    expect(ids(comparedRefs(dataset, europe, ["eu.es", "eu.de"]))).toEqual([
      "es",
      "de",
    ]);
  });

  it("ignores paths that aren't children of the selection", () => {
    // After a drill into Germany, the markets ticked at Europe no longer apply.
    const germany = market("de");
    expect(ids(comparedRefs(dataset, germany, ["eu.de", "eu.fr"]))).toEqual([
      "veltrix",
      "nuvora",
    ]);
    expect(
      ids(comparedRefs(dataset, europe, ["eu.XX", "", "na.us", "eu.fr"])),
    ).toEqual(["fr"]);
  });

  it("counts a repeated path once", () => {
    expect(ids(comparedRefs(dataset, europe, ["eu.fr", "eu.fr"]))).toEqual([
      "fr",
    ]);
  });

  it("keeps at most four", () => {
    const all = ["eu.de", "eu.fr", "eu.gb", "eu.it", "eu.es"];
    expect(comparedRefs(dataset, europe, all)).toHaveLength(MAX_COMPARE);
  });

  it("compares nothing below a product", () => {
    const product: EntityRef = {
      level: "product",
      marketId: "de",
      id: "veltrix",
    };
    expect(comparedRefs(dataset, product, [])).toEqual([]);
  });
});

describe("toggleCompared", () => {
  const defaults = comparedRefs(dataset, europe, []);

  it("removes a compared entity, keeping the rest of what is shown", () => {
    // Unticking France from the defaults writes the other three, not an empty list.
    expect(toggleCompared(dataset, defaults, market("fr"))).toEqual([
      "eu.de",
      "eu.gb",
      "eu.it",
    ]);
  });

  it("adds an entity when there is room", () => {
    const two = comparedRefs(dataset, europe, ["eu.de", "eu.fr"]);
    expect(toggleCompared(dataset, two, market("es"))).toEqual([
      "eu.de",
      "eu.fr",
      "eu.es",
    ]);
  });

  it("ignores an addition past the limit", () => {
    expect(toggleCompared(dataset, defaults, market("es"))).toEqual([
      "eu.de",
      "eu.fr",
      "eu.gb",
      "eu.it",
    ]);
  });

  it("writes nothing when the last entity is removed", () => {
    const one = comparedRefs(dataset, europe, ["eu.fr"]);
    expect(toggleCompared(dataset, one, market("fr"))).toEqual([]);
  });
});
