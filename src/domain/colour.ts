/**
 * Colour scales built only from tokens, so charts follow the theme and never use literals.
 * No data is always the muted token.
 */

const NO_DATA = "var(--muted)";
const MIDPOINT = "var(--diverging-midpoint)";
const NEGATIVE = "var(--diverging-negative)";
const POSITIVE = "var(--diverging-positive)";

/** `side` mixed into the midpoint by `share` (0..1), as a whole percentage. */
function mix(side: string, share: number): string {
  const percent = Math.round(Math.min(1, Math.max(0, share)) * 100);
  if (percent === 0) return MIDPOINT;
  if (percent === 100) return side;
  return `color-mix(in oklch, ${side} ${percent}%, ${MIDPOINT})`;
}

/**
 * Below the midpoint mixes toward the negative token, above toward the positive one; one
 * `spread` away reaches the full colour of that side.
 */
export function divergingColour(
  value: number | undefined,
  { midpoint, spread }: { midpoint: number; spread: number },
): string {
  if (value === undefined) return NO_DATA;
  const side = value < midpoint ? NEGATIVE : POSITIVE;
  return mix(side, Math.abs(value - midpoint) / spread);
}

/** Zero is the midpoint token and `max` the full positive token: for values with no "bad" side. */
export function sequentialColour(
  value: number | undefined,
  max: number,
): string {
  if (value === undefined) return NO_DATA;
  return max > 0 ? mix(POSITIVE, value / max) : MIDPOINT;
}
