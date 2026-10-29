"use client";

import {
  formatMetricOrMissing,
  formatPercent,
  formatPeriod,
} from "@/domain/format";
import {
  heatColour,
  heatmapRows,
  heatmapSummary,
  type HeatmapRow,
} from "@/domain/heatmap";
import { isMonth } from "@/domain/period";
import type { Dataset, EntityRef, PeriodRef } from "@/domain/schema";
import { childLevelOf, entityLabel, pathOf } from "@/domain/selectors";
import { useSetPeriod } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { ChartLegend } from "@/ui/ChartLegend";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

/** Room for the row labels on the left, and for the month labels underneath. */
const LABEL_WIDTH = 160;
const MARGIN = { top: 8, right: 8, bottom: 28 };
/** Label every third month, counting back from the latest, as the trend chart does. */
const TICK_EVERY = 3;
const LABEL_COLOUR = "var(--muted-foreground)";

/** The legend's three reference points: the ends of the scale and its midpoint. */
const SCALE_STOPS = [
  { label: "80% or less", attainment: 0.8 },
  { label: "100%", attainment: 1 },
  { label: "120% or more", attainment: 1.2 },
] as const;

/**
 * Attainment by child entity (rows) and month (columns). Renders nothing when the selection
 * has no children, such as a product. A cell focuses its month and selects it.
 */
export function AttainmentHeatMap({ dataset, selected, period }: Props) {
  const setPeriod = useSetPeriod();
  const rows = heatmapRows(dataset, selected);
  const months = dataset.periods;
  const selectedColumn = isMonth(period) ? months.indexOf(period) : -1;
  // Keyboard users enter on the selected month, or the latest when a quarter is shown.
  const roving = useRovingIndex(
    rows.length * months.length,
    selectedColumn === -1 ? months.length - 1 : selectedColumn,
    months.length,
  );
  const name = entityLabel(dataset, selected);
  const childLevel = childLevelOf(selected);

  if (childLevel === undefined || rows.length === 0) return null;

  return (
    <ChartFrame
      title={`${name} attainment by ${childLevel} and month`}
      summary={heatmapSummary(dataset, rows)}
      table={<HeatMapTable name={name} rows={rows} dataset={dataset} />}
      legend={<HeatMapLegend />}
      drawing={(size) => {
        const grid = gridGeometry(size, rows.length, months.length);
        return (
          <g>
            {rows.map((row, r) => (
              <text
                key={rowKey(dataset, row, r)}
                x={LABEL_WIDTH - 8}
                y={grid.rowY(r) + grid.cellHeight / 2}
                textAnchor="end"
                dominantBaseline="central"
                fill={LABEL_COLOUR}
                fontSize={11}
              >
                {entityLabel(dataset, row.ref)}
              </text>
            ))}
            {rows.flatMap((row, r) =>
              row.cells.map((cell, c) => (
                <rect
                  key={`${rowKey(dataset, row, r)}-${cell.period}`}
                  x={grid.columnX(c)}
                  y={grid.rowY(r)}
                  width={grid.cellWidth}
                  height={grid.cellHeight}
                  style={{ fill: heatColour(cell.attainment) }}
                />
              )),
            )}
            {selectedColumn === -1 ? null : (
              <rect
                x={grid.columnX(selectedColumn)}
                y={MARGIN.top}
                width={grid.cellWidth}
                height={grid.plotHeight}
                className="fill-none stroke-foreground stroke-2"
              />
            )}
            {months.map((month, c) =>
              (months.length - 1 - c) % TICK_EVERY === 0 ? (
                <text
                  key={month}
                  x={grid.columnX(c) + grid.cellWidth / 2}
                  y={size.height - 8}
                  textAnchor="middle"
                  fill={LABEL_COLOUR}
                  fontSize={11}
                >
                  {formatPeriod(month)}
                </text>
              ) : null,
            )}
          </g>
        );
      }}
      points={(size) => {
        const grid = gridGeometry(size, rows.length, months.length);
        return rows.flatMap((row, r) =>
          row.cells.map((cell, c) => {
            const index = r * months.length + c;
            const label = `${entityLabel(dataset, row.ref)}, ${formatPeriod(cell.period)}`;
            return (
              <button
                key={`${rowKey(dataset, row, r)}-${cell.period}`}
                type="button"
                {...roving.itemProps(index)}
                aria-label={
                  cell.attainment === undefined
                    ? `${label}: no data`
                    : `${label}: ${formatPercent(cell.attainment)} of forecast`
                }
                onClick={() => setPeriod(cell.period)}
                style={{
                  left: grid.columnX(c),
                  top: grid.rowY(r),
                  width: grid.cellWidth,
                  height: grid.cellHeight,
                }}
                className="pointer-events-auto absolute rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            );
          }),
        );
      }}
    />
  );
}

/** Where each cell sits inside the svg. The points overlay uses the same numbers. */
function gridGeometry(
  size: { width: number; height: number },
  rowCount: number,
  columnCount: number,
) {
  const plotWidth = Math.max(0, size.width - LABEL_WIDTH - MARGIN.right);
  const plotHeight = Math.max(0, size.height - MARGIN.top - MARGIN.bottom);
  const cellWidth = plotWidth / columnCount;
  const cellHeight = plotHeight / rowCount;
  return {
    plotHeight,
    cellWidth,
    cellHeight,
    columnX: (column: number) => LABEL_WIDTH + column * cellWidth,
    rowY: (row: number) => MARGIN.top + row * cellHeight,
  };
}

/** A stable React key for a row: its drill path, or its position if it has none. */
function rowKey(dataset: Dataset, row: HeatmapRow, index: number): string {
  return pathOf(dataset, row.ref) ?? `row-${index}`;
}

/** The scale in words and swatches, so the colours are never the only key. */
function HeatMapLegend() {
  const items = [
    ...SCALE_STOPS.map((stop) => ({
      label: stop.label,
      colour: heatColour(stop.attainment),
    })),
    { label: "No data", colour: heatColour(undefined) },
  ];
  return (
    <ChartLegend
      items={items.map(({ label, colour }) => ({
        label,
        swatch: (
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: colour }}
          />
        ),
      }))}
    />
  );
}

function HeatMapTable({
  name,
  rows,
  dataset,
}: {
  name: string;
  rows: HeatmapRow[];
  dataset: Dataset;
}) {
  return (
    // 24 months don't fit narrow screens: the table scrolls, so keyboard users must be able
    // to focus the scroll container to scroll it (WCAG 2.1.1, axe scrollable-region-focusable).
    <div
      role="region"
      aria-label={`${name} attainment table`}
      tabIndex={0}
      className="overflow-x-auto rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-muted-foreground">
          {name} attainment by month
        </caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-1.5 text-left font-medium">
              {/* Empty corner: the row headers name each row. */}
              <span className="sr-only">Entity</span>
            </th>
            {dataset.periods.map((period) => (
              <th
                key={period}
                scope="col"
                className="px-2 py-1.5 text-right font-medium whitespace-nowrap"
              >
                {formatPeriod(period)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row, r) => (
            <tr key={rowKey(dataset, row, r)} className="border-b">
              <th
                scope="row"
                className="py-1.5 pr-3 text-left font-normal whitespace-nowrap"
              >
                {entityLabel(dataset, row.ref)}
              </th>
              {row.cells.map((cell) => (
                <td
                  key={cell.period}
                  className="px-2 py-1.5 text-right whitespace-nowrap"
                >
                  {formatMetricOrMissing("attainment", cell.attainment)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
