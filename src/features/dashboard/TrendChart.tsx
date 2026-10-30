import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Line, LinePath } from "@visx/shape";
import { Flag } from "lucide-react";
import { formatCurrency, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, Month, PeriodRef } from "@/domain/schema";
import {
  entityLabel,
  entityName,
  monthlySeries,
  pathOf,
  trendAnomalies,
  type TrendPoint,
} from "@/domain/selectors";
import { trendSummary } from "@/domain/summaries";
import { useSetPeriod, type Mode } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { ChartLegend } from "@/ui/ChartLegend";
import { cn } from "@/ui/cn";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = {
  dataset: Dataset;
  selected: EntityRef;
  period: PeriodRef;
  /** Exec shows actual against forecast; analyst adds the prior year and anomaly markers. */
  mode: Mode;
};

/** An anomaly as the chart shows it: `source` names a descendant it rolled up from. */
type MonthAnomaly = { source: string | undefined; note: string };

const MARGIN = { top: 12, right: 16, bottom: 28, left: 64 };
/** Label every third month, so the axis stays readable at any width. */
const TICK_EVERY = 3;
const AXIS_COLOUR = "var(--border)";
const LABEL_COLOUR = "var(--muted-foreground)";

/**
 * The anomalies to mark by month, in period order, analyst view only. One recorded against a
 * descendant (Beacon in Germany, on Germany's trend) names it, so the note is never read as
 * the selection's own.
 */
function anomaliesByMonth(
  dataset: Dataset,
  selected: EntityRef,
  mode: Mode,
): Map<Month, MonthAnomaly[]> {
  const byMonth = new Map<Month, MonthAnomaly[]>();
  if (mode !== "analyst") return byMonth;
  const own = pathOf(dataset, selected);
  for (const { period, ref, note } of trendAnomalies(dataset, selected)) {
    const source =
      pathOf(dataset, ref) === own ? undefined : entityName(dataset, ref);
    byMonth.set(period, [...(byMonth.get(period) ?? []), { source, note }]);
  }
  return byMonth;
}

/** "Anomaly in Beacon in Germany: …" for a point's label. */
function anomalySentence({ source, note }: MonthAnomaly): string {
  return source === undefined
    ? `Anomaly: ${note}`
    : `Anomaly in ${source}: ${note}`;
}

/** "Beacon in Germany: …" for the table, where the column already says "Anomaly". */
function anomalyCell({ source, note }: MonthAnomaly): string {
  return source === undefined ? note : `${source}: ${note}`;
}

/** Revenue against forecast (and prior year, for analysts) by month; a point focuses its month. */
export function TrendChart({ dataset, selected, period, mode }: Props) {
  const showPriorYear = mode === "analyst";
  const anomalies = anomaliesByMonth(dataset, selected, mode);
  const showAnomalies = anomalies.size > 0;
  const anomaliesIn = (month: Month) => anomalies.get(month) ?? [];
  const setPeriod = useSetPeriod();
  const series = monthlySeries(dataset, selected);
  const selectedIndex = series.findIndex((point) => point.period === period);
  // Keyboard users enter on the selected month, or the latest when a quarter is shown.
  const roving = useRovingIndex(
    series.length,
    selectedIndex === -1 ? undefined : selectedIndex,
  );
  const name = entityLabel(dataset, selected);

  const scales = ({ width, height }: { width: number; height: number }) => {
    const peak = Math.max(
      1,
      ...series.flatMap((p) =>
        showPriorYear
          ? [p.actual, p.forecast, p.priorYear]
          : [p.actual, p.forecast],
      ),
    );
    return {
      x: scaleLinear({
        domain: [0, Math.max(1, series.length - 1)],
        range: [MARGIN.left, width - MARGIN.right],
      }),
      y: scaleLinear({
        domain: [0, peak],
        range: [height - MARGIN.bottom, MARGIN.top],
        nice: true,
      }),
    };
  };

  return (
    <ChartFrame
      title={`${name} revenue`}
      summary={trendSummary(series, name, [...anomalies.keys()])}
      table={
        <TrendTable
          name={name}
          series={series}
          showPriorYear={showPriorYear}
          showAnomalies={showAnomalies}
          anomaliesIn={anomaliesIn}
        />
      }
      legend={
        <TrendLegend
          showPriorYear={showPriorYear}
          showAnomalies={showAnomalies}
        />
      }
      drawing={(size) => {
        const { x, y } = scales(size);
        const line = (pick: (p: TrendPoint) => number) => ({
          data: series,
          x: (_: TrendPoint, i: number) => x(i),
          y: (p: TrendPoint) => y(pick(p)),
          fill: "none",
          strokeWidth: 2,
        });
        return (
          <Group>
            <AxisLeft
              left={MARGIN.left}
              scale={y}
              numTicks={4}
              tickFormat={(value) => formatCurrency(Number(value))}
              stroke={AXIS_COLOUR}
              tickStroke={AXIS_COLOUR}
              tickLabelProps={{ fill: LABEL_COLOUR, fontSize: 11 }}
            />
            <AxisBottom
              top={size.height - MARGIN.bottom}
              scale={x}
              tickValues={series
                .map((_, i) => i)
                .filter((i) => (series.length - 1 - i) % TICK_EVERY === 0)}
              tickFormat={(value) => {
                const point = series[Number(value)];
                return point ? formatPeriod(point.period) : "";
              }}
              stroke={AXIS_COLOUR}
              tickStroke={AXIS_COLOUR}
              tickLabelProps={{ fill: LABEL_COLOUR, fontSize: 11 }}
            />
            {series.map((point, i) =>
              anomaliesIn(point.period).length > 0 ? (
                <Line
                  key={point.period}
                  from={{ x: x(i), y: MARGIN.top }}
                  to={{ x: x(i), y: size.height - MARGIN.bottom }}
                  className="stroke-muted-foreground"
                  strokeDasharray="2 3"
                />
              ) : null,
            )}
            {showPriorYear && (
              <LinePath
                {...line((p) => p.priorYear)}
                className="stroke-chart-5"
                strokeDasharray="4 4"
              />
            )}
            <LinePath {...line((p) => p.forecast)} className="stroke-chart-2" />
            <LinePath {...line((p) => p.actual)} className="stroke-chart-1" />
          </Group>
        );
      }}
      points={(size) => {
        const { x, y } = scales(size);
        return series.map((point, index) => {
          const selectedMonth = point.period === period;
          const flagged = anomaliesIn(point.period);
          const label = `${formatPeriod(point.period)}: revenue ${formatCurrency(point.actual)}, forecast ${formatCurrency(point.forecast)}${showPriorYear ? `, prior year ${formatCurrency(point.priorYear)}` : ""}.`;
          return (
            <button
              key={point.period}
              type="button"
              {...roving.itemProps(index)}
              aria-label={[label, ...flagged.map(anomalySentence)].join(" ")}
              aria-current={selectedMonth ? "date" : undefined}
              onClick={() => setPeriod(point.period)}
              style={{ left: x(index), top: y(point.actual) }}
              className={cn(
                "pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chart-1 bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selectedMonth && "size-4 bg-chart-1",
              )}
            >
              {flagged.length > 0 && (
                <Flag
                  aria-hidden
                  className="absolute bottom-full left-1/2 mb-1 size-3.5 -translate-x-1/2 text-foreground"
                />
              )}
            </button>
          );
        });
      }}
    />
  );
}

/** Each line by colour and by style, so the dashed line isn't explained by colour alone. */
function TrendLegend({
  showPriorYear,
  showAnomalies,
}: {
  showPriorYear: boolean;
  showAnomalies: boolean;
}) {
  const items = [
    { label: "Actual", line: "border-chart-1" },
    { label: "Forecast", line: "border-chart-2" },
    ...(showPriorYear
      ? [{ label: "Prior year", line: "border-dashed border-chart-5" }]
      : []),
  ];
  return (
    <ChartLegend
      items={[
        ...items.map(({ label, line }) => ({
          label,
          swatch: <span className={cn("w-5 border-t-2", line)} />,
        })),
        ...(showAnomalies
          ? [
              {
                label: "Anomaly",
                swatch: <Flag aria-hidden className="size-3.5" />,
              },
            ]
          : []),
      ]}
    />
  );
}

function TrendTable({
  name,
  series,
  showPriorYear,
  showAnomalies,
  anomaliesIn,
}: {
  name: string;
  series: TrendPoint[];
  showPriorYear: boolean;
  showAnomalies: boolean;
  anomaliesIn: (month: Month) => MonthAnomaly[];
}) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-muted-foreground">
        {name} revenue by month
      </caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1.5 text-left font-medium">
            Month
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Actual
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Forecast
          </th>
          {showPriorYear && (
            <th scope="col" className="py-1.5 text-right font-medium">
              Prior year
            </th>
          )}
          {showAnomalies && (
            <th scope="col" className="py-1.5 pl-4 text-left font-medium">
              Anomaly
            </th>
          )}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {series.map((point) => (
          <tr key={point.period} className="border-b">
            <th scope="row" className="py-1.5 text-left font-normal">
              {formatPeriod(point.period)}
            </th>
            <td className="py-1.5 text-right">
              {formatCurrency(point.actual)}
            </td>
            <td className="py-1.5 text-right">
              {formatCurrency(point.forecast)}
            </td>
            {showPriorYear && (
              <td className="py-1.5 text-right">
                {formatCurrency(point.priorYear)}
              </td>
            )}
            {showAnomalies && (
              <td className="py-1.5 pl-4 text-left">
                {anomaliesIn(point.period).map(anomalyCell).join(" ")}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
