// @vitest-environment node
/**
 * Status colours are used for text (StatusBadge), so each must reach WCAG AA (4.5:1) on
 * every surface it sits on. Reads the real tokens, so a palette tweak can't regress it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

type Oklch = [number, number, number];

function token(name: string): Oklch {
  const match = css.match(
    new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`),
  );
  if (!match) throw new Error(`No oklch token --${name}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Relative luminance (WCAG) of an OKLCH colour, via linear sRGB. */
function luminance([l, c, h]: Oklch): number {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const [L, M, S] = lms;
  const rgb = [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ].map((v) => Math.min(1, Math.max(0, v)));
  const [r = 0, g = 0, bl = 0] = rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}

function contrast(x: Oklch, y: Oklch): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe("status tokens", () => {
  // accent: a linked-highlight row puts status badges on it.
  const surfaces = ["card", "background", "accent"];
  const statuses = ["status-on-track", "status-at-risk", "status-off-track"];

  it.each(statuses.flatMap((s) => surfaces.map((bg) => [s, bg])))(
    "%s text reaches 4.5:1 on %s",
    (status, surface) => {
      expect(contrast(token(status), token(surface))).toBeGreaterThanOrEqual(
        4.5,
      );
    },
  );

  it("keeps muted text readable on a highlighted (accent) row", () => {
    expect(
      contrast(token("muted-foreground"), token("accent")),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("agrees with axe on the colour it flagged", () => {
    // axe measured oklch(0.6 0.13 70) (#b17000) at 4.04:1 on white.
    expect(contrast([0.6, 0.13, 70], [1, 0, 0])).toBeCloseTo(4.05, 1);
  });
});
