import {
  formatMetricName,
  formatMetricOrMissing,
  formatPercent,
} from "@/domain/format";
import {
  RADAR_METRICS,
  radarAxes,
  radarSummary,
  type RadarMetric,
  type RadarSeries,
  type RadarValue,
} from "@/domain/radar";
import type { Dataset, EntityRef, PeriodRef } from "@/domain/schema";
import { childrenOf, entityLabel } from "@/domain/selectors";
import { MAX_COMPARE, useCompare } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { cn } from "@/ui/cn";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

const HEIGHT = 320;
/** Room outside the outer ring for axis labels. */
const LABEL_ROOM = 64;
/** Gap between the outer ring and an axis label, in px. */
const LABEL_GAP = 12;
const RINGS = [0.25, 0.5, 0.75, 1];
const AXIS_COLOUR = "var(--border)";
const LABEL_COLOUR = "var(--muted-foreground)";

/**
 * Each series by colour and by dash, so no two are told apart by colour alone. Classes are
 * spelled out in full because Tailwind only generates classes it can find in the source.
 */
const SERIES_STYLES = [
  { stroke: "stroke-chart-1", border: "border-chart-1", dash: undefined },
  { stroke: "stroke-chart-2", border: "border-chart-2", dash: "6 3" },
  { stroke: "stroke-chart-3", border: "border-chart-3", dash: "2 3" },
  { stroke: "stroke-chart-4", border: "border-chart-4", dash: "8 3 2 3" },
] as const;

/**
 * The entities compared on five axes: the ones the URL names, or else the first few children of
 * the selection. Nothing is compared below a product, so the radar renders nothing there.
 */
export function CompareRadar({ dataset, selected, period }: Props) {
  const chosen = useCompare();
  const refs =
    chosen.length > 0
      ? chosen
      : childrenOf(dataset, selected).slice(0, MAX_COMPARE);
  const series = radarAxes(dataset, refs, period);
  // Hooks run before the early return; the grid is one row per series, one column per axis.
  const roving = useRovingIndex(
    series.length * RADAR_METRICS.length,
    0,
    RADAR_METRICS.length,
  );

  if (series.length === 0) return null;

  return (
    <ChartFrame
      title="Compare"
      summary={radarSummary(dataset, series, period)}
      height={HEIGHT}
      table={<RadarTable dataset={dataset} series={series} />}
      legend={<RadarLegend dataset={dataset} series={series} />}
      drawing={(size) => {
        const geometry = radarGeometry(size.width, size.height);
        return (
          <g>
            {RINGS.map((level) => (
              <polygon
                key={level}
                points={polygonPoints(
                  geometry,
                  RADAR_METRICS.map(() => level),
                )}
                fill="none"
                stroke={AXIS_COLOUR}
              />
            ))}
            {RADAR_METRICS.map((metric, axis) => {
              const spoke = vertex(geometry, axis, 1);
              const label = vertex(geometry, axis, 1, LABEL_GAP);
              return (
                <g key={metric}>
                  <line
                    x1={geometry.cx}
                    y1={geometry.cy}
                    x2={spoke.x}
                    y2={spoke.y}
                    stroke={AXIS_COLOUR}
                  />
                  <text
                    x={label.x}
                    y={label.y}
                    fill={LABEL_COLOUR}
                    fontSize={11}
                    textAnchor={anchorFor(geometry, axis)}
                    dominantBaseline="middle"
                  >
                    {formatMetricName(metric)}
                  </text>
                </g>
              );
            })}
            {series.map((entry, row) => {
              const style = styleFor(row);
              return (
                <polygon
                  key={row}
                  points={polygonPoints(
                    geometry,
                    RADAR_METRICS.map((metric) => entry.values[metric].scaled),
                  )}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray={style.dash}
                  className={style.stroke}
                />
              );
            })}
          </g>
        );
      }}
      points={(size) => {
        const geometry = radarGeometry(size.width, size.height);
        return series.flatMap((entry, row) => {
          const style = styleFor(row);
          const name = entityLabel(dataset, entry.ref);
          return RADAR_METRICS.map((metric, axis) => {
            const { x, y } = vertex(
              geometry,
              axis,
              entry.values[metric].scaled,
            );
            const raw = entry.values[metric].raw;
            return (
              <button
                key={`${row}-${metric}`}
                type="button"
                {...roving.itemProps(row * RADAR_METRICS.length + axis)}
                aria-label={`${name}, ${formatMetricName(metric)}: ${formatMetricOrMissing(metric, raw)}`}
                style={{ left: x, top: y }}
                className={cn(
                  "pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  style.border,
                )}
              />
            );
          });
        });
      }}
    />
  );
}

type Geometry = { cx: number; cy: number; radius: number };

function radarGeometry(width: number, height: number): Geometry {
  return {
    cx: width / 2,
    cy: height / 2,
    radius: Math.max(0, Math.min(width, height) / 2 - LABEL_ROOM),
  };
}

/** Axis 0 points up; the rest follow clockwise. `scaled` is a fraction of the radius. */
function vertex(
  geometry: Geometry,
  axis: number,
  scaled: number,
  outset = 0,
): { x: number; y: number } {
  const angle = -Math.PI / 2 + (axis * 2 * Math.PI) / RADAR_METRICS.length;
  const distance = geometry.radius * scaled + outset;
  return {
    x: geometry.cx + distance * Math.cos(angle),
    y: geometry.cy + distance * Math.sin(angle),
  };
}

/** One vertex per axis, in axis order: `scaled[axis]` is that axis's distance from the centre. */
function polygonPoints(geometry: Geometry, scaled: number[]): string {
  return scaled
    .map((value, axis) => {
      const { x, y } = vertex(geometry, axis, value);
      return `${x},${y}`;
    })
    .join(" ");
}

/** Labels on the right grow rightwards, on the left grow leftwards, and top or bottom centre. */
function anchorFor(
  geometry: Geometry,
  axis: number,
): "start" | "middle" | "end" {
  const { x } = vertex(geometry, axis, 1, LABEL_GAP);
  const offset = x - geometry.cx;
  if (Math.abs(offset) < 1) return "middle";
  return offset > 0 ? "start" : "end";
}

function styleFor(row: number) {
  // The compare list is capped at MAX_COMPARE, so this only guards the index type.
  return SERIES_STYLES[row] ?? SERIES_STYLES[0];
}

function RadarLegend({
  dataset,
  series,
}: {
  dataset: Dataset;
  series: RadarSeries[];
}) {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-4 text-xs text-muted-foreground"
    >
      {series.map((entry, row) => {
        const style = styleFor(row);
        return (
          <li key={row} className="flex items-center gap-1.5">
            <svg aria-hidden width={20} height={4} className="block">
              <line
                x1={0}
                y1={2}
                x2={20}
                y2={2}
                strokeWidth={2}
                strokeDasharray={style.dash}
                className={style.stroke}
              />
            </svg>
            {entityLabel(dataset, entry.ref)}
          </li>
        );
      })}
    </ul>
  );
}

function RadarTable({
  dataset,
  series,
}: {
  dataset: Dataset;
  series: RadarSeries[];
}) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-muted-foreground">
        Compared values
      </caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1.5 text-left font-medium">
            Entity
          </th>
          {RADAR_METRICS.map((metric) => (
            <th
              key={metric}
              scope="col"
              className="py-1.5 text-right font-medium"
            >
              {formatMetricName(metric)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {series.map((entry) => (
          <tr key={entityLabel(dataset, entry.ref)} className="border-b">
            <th scope="row" className="py-1.5 text-left font-normal">
              {entityLabel(dataset, entry.ref)}
            </th>
            {RADAR_METRICS.map((metric) => (
              <RadarCell
                key={metric}
                metric={metric}
                value={entry.values[metric]}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RadarCell({
  metric,
  value,
}: {
  metric: RadarMetric;
  value: RadarValue;
}) {
  return (
    <td className="py-1.5 text-right">
      {formatMetricOrMissing(metric, value.raw)}
      {value.raw === undefined ? null : (
        <span className="block text-xs text-muted-foreground">
          scaled {formatPercent(value.scaled)}
        </span>
      )}
    </td>
  );
}
