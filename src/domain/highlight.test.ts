import { entityPath } from "@/test/path";
import { describe, expect, it } from "vitest";
import { isLinked } from "./highlight";

describe("isLinked", () => {
  it("links an item to itself", () => {
    expect(isLinked(entityPath("eu.de"), entityPath("eu.de"))).toBe(true);
  });

  it("doesn't link an item with no path", () => {
    expect(isLinked(undefined, entityPath("eu"))).toBe(false);
  });

  it("links a market and its region, in either direction", () => {
    // The map shows markets while other views show regions at the portfolio.
    expect(isLinked(entityPath("eu.de"), entityPath("eu"))).toBe(true);
    expect(isLinked(entityPath("eu"), entityPath("eu.de"))).toBe(true);
    expect(isLinked(entityPath("eu.de.nuvora"), entityPath("eu.de"))).toBe(
      true,
    );
  });

  it("doesn't link siblings or look-alike ids", () => {
    expect(isLinked(entityPath("eu.fr"), entityPath("eu.de"))).toBe(false);
    expect(isLinked(entityPath("na.us"), entityPath("eu"))).toBe(false);
    // "eu" is not an ancestor of "eur": ancestry is by whole path segments.
    expect(isLinked(entityPath("eur.XX"), entityPath("eu"))).toBe(false);
  });

  it("links nothing when nothing is highlighted, or when the portfolio is", () => {
    expect(isLinked(entityPath("eu.de"), null)).toBe(false);
    // The portfolio ("") is everyone's ancestor; highlighting it would light up every view.
    expect(isLinked(entityPath("eu.de"), entityPath(""))).toBe(false);
    expect(isLinked(entityPath(""), entityPath("eu"))).toBe(false);
  });
});
