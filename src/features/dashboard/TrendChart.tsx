import { AxisBottom, AxisLeft } from "@visx/axis";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { formatCurrency, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, PeriodRef } from "@/domain/schema";
import {
  entityLabel,
  monthlySeries,
  type TrendPoint,
} from "@/domain/selectors";
import { trendSummary } from "@/domain/summaries";
import { useSetPeriod } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { cn } from "@/ui/cn";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

const MARGIN = { top: 12, right: 16, bottom: 28, left: 64 };
/** Label every third month, so the axis stays readable at any width. */
const TICK_EVERY = 3;
const AXIS_COLOUR = "var(--border)";
const LABEL_COLOUR = "var(--muted-foreground)";

/** Revenue against forecast and prior year by month; a point focuses its month. */
export function TrendChart({ dataset, selected, period }: Props) {
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
      ...series.flatMap((p) => [p.actual, p.forecast, p.priorYear]),
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
      summary={trendSummary(series, name)}
      table={<TrendTable name={name} series={series} />}
      legend={<TrendLegend />}
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
            <LinePath
              {...line((p) => p.priorYear)}
              className="stroke-chart-5"
              strokeDasharray="4 4"
            />
            <LinePath {...line((p) => p.forecast)} className="stroke-chart-2" />
            <LinePath {...line((p) => p.actual)} className="stroke-chart-1" />
          </Group>
        );
      }}
      points={(size) => {
        const { x, y } = scales(size);
        return series.map((point, index) => {
          const selectedMonth = point.period === period;
          return (
            <button
              key={point.period}
              type="button"
              {...roving.itemProps(index)}
              aria-label={`${formatPeriod(point.period)}: revenue ${formatCurrency(point.actual)}, forecast ${formatCurrency(point.forecast)}, prior year ${formatCurrency(point.priorYear)}`}
              aria-current={selectedMonth ? "date" : undefined}
              onClick={() => setPeriod(point.period)}
              style={{ left: x(index), top: y(point.actual) }}
              className={cn(
                "pointer-events-auto absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-chart-1 bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                selectedMonth && "size-4 bg-chart-1",
              )}
            />
          );
        });
      }}
    />
  );
}

/** Each line by colour and by style, so the dashed line isn't explained by colour alone. */
function TrendLegend() {
  const items = [
    { label: "Actual", line: "border-chart-1" },
    { label: "Forecast", line: "border-chart-2" },
    { label: "Prior year", line: "border-dashed border-chart-5" },
  ];
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-4 text-xs text-muted-foreground"
    >
      {items.map(({ label, line }) => (
        <li key={label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("w-5 border-t-2", line)} />
          {label}
        </li>
      ))}
    </ul>
  );
}

function TrendTable({ name, series }: { name: string; series: TrendPoint[] }) {
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
          <th scope="col" className="py-1.5 text-right font-medium">
            Prior year
          </th>
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
            <td className="py-1.5 text-right">
              {formatCurrency(point.priorYear)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
