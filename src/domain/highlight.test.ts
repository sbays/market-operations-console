import { describe, expect, it } from "vitest";
import { isLinked } from "./highlight";

describe("isLinked", () => {
  it("links an item to itself", () => {
    expect(isLinked("eu.DE", "eu.DE")).toBe(true);
  });

  it("links a market and its region, in either direction", () => {
    // The map shows markets while other views show regions at the portfolio.
    expect(isLinked("eu.DE", "eu")).toBe(true);
    expect(isLinked("eu", "eu.DE")).toBe(true);
    expect(isLinked("eu.DE.beacon", "eu.DE")).toBe(true);
  });

  it("doesn't link siblings or look-alike ids", () => {
    expect(isLinked("eu.FR", "eu.DE")).toBe(false);
    expect(isLinked("na.US", "eu")).toBe(false);
    // "eu" is not an ancestor of "eur": ancestry is by whole path segments.
    expect(isLinked("eur.XX", "eu")).toBe(false);
  });

  it("links nothing when nothing is highlighted, or when the portfolio is", () => {
    expect(isLinked("eu.DE", null)).toBe(false);
    // The portfolio ("") is everyone's ancestor; highlighting it would light up every view.
    expect(isLinked("eu.DE", "")).toBe(false);
    expect(isLinked("", "eu")).toBe(false);
  });
});
