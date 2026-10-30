import { entityPath } from "@/test/path";
import { describe, expect, it } from "vitest";
import { isLinked } from "./highlight";

describe("isLinked", () => {
  it("links an item to itself", () => {
    expect(isLinked(entityPath("eu.DE"), entityPath("eu.DE"))).toBe(true);
  });

  it("doesn't link an item with no path", () => {
    expect(isLinked(undefined, entityPath("eu"))).toBe(false);
  });

  it("links a market and its region, in either direction", () => {
    // The map shows markets while other views show regions at the portfolio.
    expect(isLinked(entityPath("eu.DE"), entityPath("eu"))).toBe(true);
    expect(isLinked(entityPath("eu"), entityPath("eu.DE"))).toBe(true);
    expect(isLinked(entityPath("eu.DE.beacon"), entityPath("eu.DE"))).toBe(
      true,
    );
  });

  it("doesn't link siblings or look-alike ids", () => {
    expect(isLinked(entityPath("eu.FR"), entityPath("eu.DE"))).toBe(false);
    expect(isLinked(entityPath("na.US"), entityPath("eu"))).toBe(false);
    // "eu" is not an ancestor of "eur": ancestry is by whole path segments.
    expect(isLinked(entityPath("eur.XX"), entityPath("eu"))).toBe(false);
  });

  it("links nothing when nothing is highlighted, or when the portfolio is", () => {
    expect(isLinked(entityPath("eu.DE"), null)).toBe(false);
    // The portfolio ("") is everyone's ancestor; highlighting it would light up every view.
    expect(isLinked(entityPath("eu.DE"), entityPath(""))).toBe(false);
    expect(isLinked(entityPath(""), entityPath("eu"))).toBe(false);
  });
});
