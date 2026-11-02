import type { ReactNode } from "react";

export type LegendItem = { label: string; swatch: ReactNode };

/**
 * A continuous colour scale: one bar with its reference values written underneath, so the
 * values between them read as shades of the same scale rather than missing categories.
 */
export type LegendScale = {
  /** A CSS gradient, low to high (see `gradient` in domain/colour.ts). */
  background: string;
  /** Read left to right under the bar: usually the low end, the midpoint and the high end. */
  ticks: string[];
};

/** A chart's key: an optional colour scale, then each swatch the chart draws with its label. */
export function ChartLegend({
  items,
  scale,
}: {
  items: LegendItem[];
  scale?: LegendScale;
}) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground"
    >
      {scale && (
        <li className="flex w-56 flex-col gap-1">
          <span
            aria-hidden
            className="h-3 rounded-sm"
            style={{ backgroundImage: scale.background }}
          />
          <span className="flex justify-between tabular-nums">
            {scale.ticks.map((tick) => (
              <span key={tick}>{tick}</span>
            ))}
          </span>
        </li>
      )}
      {items.map(({ label, swatch }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden className="flex">
            {swatch}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}
