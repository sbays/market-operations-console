import { describe, expect, it } from "vitest";
import { divergingColour, gradient, sequentialColour } from "./colour";

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
      "color-mix(in oklab, var(--diverging-positive) 25%, var(--diverging-midpoint))",
    );
  });
});

describe("sequentialColour", () => {
  it("runs from the midpoint token at zero to the positive token at the maximum", () => {
    expect(sequentialColour(0, 0.2)).toBe("var(--diverging-midpoint)");
    expect(sequentialColour(0.2, 0.2)).toBe("var(--diverging-positive)");
    expect(sequentialColour(0.05, 0.2)).toBe(
      "color-mix(in oklab, var(--diverging-positive) 25%, var(--diverging-midpoint))",
    );
  });

  it("is muted with no data, and the midpoint when the maximum is zero", () => {
    expect(sequentialColour(undefined, 0.2)).toBe("var(--muted)");
    expect(sequentialColour(0, 0)).toBe("var(--diverging-midpoint)");
  });
});

describe("gradient", () => {
  const growth = (value: number) =>
    divergingColour(value, { midpoint: 0, spread: 0.1 });

  it("samples the scale evenly from low to high, as a CSS gradient", () => {
    expect(gradient(growth, -0.1, 0.1, 5)).toBe(
      "linear-gradient(to right in oklab, var(--diverging-negative), " +
        "color-mix(in oklab, var(--diverging-negative) 50%, var(--diverging-midpoint)), " +
        "var(--diverging-midpoint), " +
        "color-mix(in oklab, var(--diverging-positive) 50%, var(--diverging-midpoint)), " +
        "var(--diverging-positive))",
    );
  });
});
