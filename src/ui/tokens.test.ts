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

type Rgb = [number, number, number];

/** An OKLCH colour as linear sRGB, clamped to the gamut. */
function linearRgb([l, c, h]: Oklch): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const [L, M, S] = lms;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S),
    clamp(-1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S),
    clamp(-0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S),
  ];
}

const encode = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
const decode = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

/** Relative luminance (WCAG) of a linear sRGB colour. */
function luminance([r, g, b]: Rgb): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * `top` at `alpha` over `bottom`, as a browser composites it (in gamma-encoded sRGB), e.g.
 * Tailwind's `bg-primary/80` on the page.
 */
function over(top: Oklch, alpha: number, bottom: Oklch): Rgb {
  const t = linearRgb(top).map(encode);
  const b = linearRgb(bottom).map(encode);
  const mix = (i: number) =>
    decode(alpha * (t[i] ?? 0) + (1 - alpha) * (b[i] ?? 0));
  return [mix(0), mix(1), mix(2)];
}

/** WCAG contrast ratio of two colours, given as linear sRGB. */
function ratio(x: Rgb, y: Rgb): number {
  const [hi = 0, lo = 0] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

function contrast(x: Oklch, y: Oklch): number {
  return ratio(linearRgb(x), linearRgb(y));
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

describe("primary button", () => {
  it.each([
    ["at rest", 1],
    // shadcn's button hovers at bg-primary/80 over the page; a dialog's trigger keeps that
    // hover under the overlay, where axe flagged it at 4.49:1 on WebKit.
    ["on hover", 0.8],
  ])("keeps its label at 4.5:1 %s", (_state, alpha) => {
    const fill = over(token("primary"), alpha, token("background"));
    expect(
      ratio(linearRgb(token("primary-foreground")), fill),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
