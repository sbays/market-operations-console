import type { ReactNode } from "react";

export type LegendItem = { label: string; swatch: ReactNode };

/** A chart's key: each item pairs a swatch the chart draws with a text label. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-4 text-xs text-muted-foreground"
    >
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
