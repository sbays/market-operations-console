import { describe, expect, it } from "vitest";
import { divergingColour, sequentialColour } from "./colour";

describe("divergingColour", () => {
  const growth = { midpoint: 0, spread: 0.1 };

  it("is the midpoint token at the midpoint, and muted with no data", () => {
    expect(divergingColour(0, growth)).toBe("var(--diverging-midpoint)");
    expect(divergingColour(undefined, growth)).toBe("var(--muted)");
  });

  it("reaches the full token of its side at one spread away, and stays there", () => {
    expect(divergingColour(-0.1, growth)).toBe("var(--diverging-negative)");
    expect(divergingColour(-0.5, growth)).toBe("var(--diverging-negative)");
    expect(divergingColour(0.1, growth)).toBe("var(--diverging-positive)");
  });

  it("mixes in proportion between the midpoint and a side", () => {
    expect(divergingColour(0.025, growth)).toBe(
      "color-mix(in oklch, var(--diverging-positive) 25%, var(--diverging-midpoint))",
    );
  });
});

describe("sequentialColour", () => {
  it("runs from the midpoint token at zero to the positive token at the maximum", () => {
    expect(sequentialColour(0, 0.2)).toBe("var(--diverging-midpoint)");
    expect(sequentialColour(0.2, 0.2)).toBe("var(--diverging-positive)");
    expect(sequentialColour(0.05, 0.2)).toBe(
      "color-mix(in oklch, var(--diverging-positive) 25%, var(--diverging-midpoint))",
    );
  });

  it("is muted with no data, and the midpoint when the maximum is zero", () => {
    expect(sequentialColour(undefined, 0.2)).toBe("var(--muted)");
    expect(sequentialColour(0, 0)).toBe("var(--diverging-midpoint)");
  });
});
