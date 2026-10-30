"use client";

import { geoPath } from "d3-geo";
import { useId } from "react";
import {
  countryFeatures,
  MARKET_GEO_IDS,
  marketAnchor,
  marketsInSelection,
  worldProjection,
} from "@/domain/geo";
import { divergingColour, sequentialColour } from "@/domain/colour";
import {
  formatMetric,
  formatMetricName,
  formatPercent,
  formatPeriod,
  formatStatus,
} from "@/domain/format";
import type { Dataset, EntityRef, PeriodRef, Status } from "@/domain/schema";
import { isLinked } from "@/domain/highlight";
import { entityLabel, pathOf, statusAt, valueAt } from "@/domain/selectors";
import { linkedProps, useHighlightedPath } from "@/state/highlight";
import {
  MAP_METRICS,
  useDrill,
  useMapMetric,
  useSetMapMetric,
  type MapMetric,
} from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { ChartLegend } from "@/ui/ChartLegend";
import { cn } from "@/ui/cn";
import { StatusBadge, StatusIcon } from "@/ui/StatusBadge";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

type Mark = {
  id: string;
  name: string;
  /** The metric the map colours by. */
  value: number;
  status: Status;
  inSelection: boolean;
};

/** How the metric reads inside a sentence: "Markets by growth", "Germany: growth +2.4%". */
const METRIC_WORD: Record<MapMetric, string> = {
  attainment: "attainment",
  growth: "growth",
  share: "market share",
};

const BUTTON_LABEL: Record<MapMetric, string> = {
  attainment: "Attainment",
  growth: "Growth",
  share: "Share",
};

/** Growth this far from zero (on either side) reaches the full colour of its side. */
const GROWTH_SPREAD = 0.1;

// Each marker has its status icon and label; the map fill and hatch only reinforce them.
const STATUS_FILL: Record<Status, string> = {
  "on-track": "fill-status-on-track",
  "at-risk": "fill-status-at-risk",
  "off-track": "fill-status-off-track",
};
const STATUS_ORDER: Status[] = ["on-track", "at-risk", "off-track"];

const HATCH_SPACING = 6;

/** One metric per dataset market over a period. Markets the data doesn't cover are left out. */
function marksFor(
  dataset: Dataset,
  selected: EntityRef,
  period: PeriodRef,
  metric: MapMetric,
): Mark[] {
  const inSelection = marketsInSelection(dataset, selected);
  return dataset.markets.flatMap((market) => {
    const ref: EntityRef = { level: "market", id: market.id };
    const value = valueAt(dataset, ref, period, metric);
    const status = statusAt(dataset, ref, period);
    if (value === undefined || status === undefined) return [];
    return [
      {
        id: market.id,
        name: market.name,
        value,
        status,
        inSelection: inSelection.has(market.id),
      },
    ];
  });
}

/** Lowest first: the market a reader most needs to find. */
function byValue(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => a.value - b.value);
}

/** "Germany: attainment 95.4%, at risk", the words a marker is read out as. */
function markLabel(mark: Mark, metric: MapMetric): string {
  return `${mark.name}: ${METRIC_WORD[metric]} ${formatMetric(metric, mark.value)}, ${formatStatus(mark.status).toLowerCase()}`;
}

/** The largest share among the markets in the selection: the top of the share scale. */
function maxShare(marks: Mark[]): number {
  return Math.max(0, ...marks.filter((m) => m.inSelection).map((m) => m.value));
}

/** A country's fill for growth or share; attainment uses the status classes instead. */
function scaleFill(metric: MapMetric, value: number, top: number): string {
  return metric === "share"
    ? sequentialColour(value, top)
    : divergingColour(value, { midpoint: 0, spread: GROWTH_SPREAD });
}

/**
 * The map's one-sentence description of the markets in the selection, built from the same
 * figures the markers show. Muted markets are outside it, so they aren't described.
 */
function mapSummary(
  dataset: Dataset,
  selected: EntityRef,
  marks: Mark[],
  period: PeriodRef,
  metric: MapMetric,
): string {
  const shown = byValue(marks.filter((m) => m.inSelection));
  const when = formatPeriod(period);
  const lowest = shown[0];
  const highest = shown.at(-1);
  if (!lowest || !highest) return `No market data for ${when}.`;
  if (selected.level === "market" || selected.level === "product") {
    return `${markLabel(lowest, metric)}, in ${when}.`;
  }
  if (metric !== "attainment") {
    const where =
      selected.level === "region"
        ? ` in ${entityLabel(dataset, selected)}`
        : "";
    const word = METRIC_WORD[metric];
    const sentenceWord = word.charAt(0).toUpperCase() + word.slice(1);
    return `${sentenceWord}${where} in ${when} runs from ${lowest.name} at ${formatMetric(metric, lowest.value)} to ${highest.name} at ${formatMetric(metric, highest.value)}.`;
  }
  const flagged = shown.filter((m) => m.status !== "on-track").length;
  const verb = flagged === 1 ? "is" : "are";
  const where =
    selected.level === "region" ? ` in ${entityLabel(dataset, selected)}` : "";
  return `${flagged} of ${shown.length} markets${where} ${verb} off track or at risk in ${when}; the lowest is ${lowest.name} at ${formatMetric("attainment", lowest.value)}.`;
}

/**
 * Markets on a world map, coloured by attainment (status), growth or share (the URL's
 * `mapMetric`). Countries outside the selection are muted; for attainment, off track is also
 * hatched. A marker per market shows its status icon, and focuses and drills to that market.
 */
export function MarketMap({ dataset, selected, period }: Props) {
  const drill = useDrill();
  const highlighted = useHighlightedPath();
  const metric = useMapMetric();
  const marks = marksFor(dataset, selected, period, metric);
  const top = maxShare(marks);
  const title = `Markets by ${METRIC_WORD[metric]}`;
  const marketPath = (id: string) => pathOf(dataset, { level: "market", id });
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  // Keyboard users enter on the selected market, or the first market at the portfolio.
  const selectedMarketId =
    selected.level === "market"
      ? selected.id
      : selected.level === "product"
        ? selected.marketId
        : undefined;
  const entryIndex = Math.max(
    0,
    marks.findIndex((m) => m.id === selectedMarketId),
  );
  const roving = useRovingIndex(marks.length, entryIndex);

  const summary = mapSummary(dataset, selected, marks, period, metric);

  return (
    <div className="flex flex-col gap-3">
      <MetricToggle metric={metric} />
      <ChartFrame
        title={title}
        summary={summary}
        height={320}
        table={<MarketTable marks={marks} metric={metric} title={title} />}
        legend={<MapLegend metric={metric} top={top} />}
        drawing={(size) => {
          const path = geoPath(worldProjection(size));
          return (
            <g>
              <defs>
                <pattern
                  id={hatchId}
                  width={HATCH_SPACING}
                  height={HATCH_SPACING}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={HATCH_SPACING}
                    strokeWidth={2}
                    className="stroke-background"
                  />
                </pattern>
              </defs>
              {countryFeatures.map((country, index) => {
                const d = path(country) ?? undefined;
                const mark = marks.find(
                  (m) => MARKET_GEO_IDS[m.id] === String(country.id),
                );
                const className =
                  mark === undefined
                    ? "fill-muted stroke-background"
                    : !mark.inSelection
                      ? "fill-muted stroke-border"
                      : metric === "attainment"
                        ? `${STATUS_FILL[mark.status]} stroke-background`
                        : "stroke-background";
                const fill =
                  mark?.inSelection && metric !== "attainment"
                    ? scaleFill(metric, mark.value, top)
                    : undefined;
                // A linked market's country gets a heavier outline, on top of its fill.
                const linked =
                  mark !== undefined &&
                  isLinked(marketPath(mark.id), highlighted);
                return (
                  <g key={String(country.id ?? index)}>
                    <path
                      d={d}
                      className={cn(className, linked && "stroke-foreground")}
                      style={fill === undefined ? undefined : { fill }}
                      strokeWidth={linked ? 1.5 : 0.5}
                    />
                    {metric === "attainment" &&
                    mark?.inSelection &&
                    mark.status === "off-track" ? (
                      <path
                        d={d}
                        fill={`url(#${hatchId})`}
                        pointerEvents="none"
                      />
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        }}
        points={(size) => {
          const project = worldProjection(size);
          return marks.map((mark, index) => {
            const anchor = marketAnchor(mark.id, project);
            if (anchor === undefined) return null;
            const [x, y] = anchor;
            const item = roving.itemProps(index);
            const link = linkedProps(
              marketPath(mark.id),
              isLinked(marketPath(mark.id), highlighted),
              item,
            );
            return (
              <button
                key={mark.id}
                type="button"
                {...item}
                {...link}
                aria-label={markLabel(mark, metric)}
                onClick={() => drill({ level: "market", id: mark.id })}
                style={{ left: x, top: y }}
                className={cn(
                  "pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  link["data-linked"] && "ring-2 ring-foreground",
                )}
              >
                <StatusIcon status={mark.status} />
              </button>
            );
          });
        }}
      />
    </div>
  );
}

/** What the map colours by: a pair of toggle buttons, like the view mode. */
function MetricToggle({ metric }: { metric: MapMetric }) {
  const setMetric = useSetMapMetric();
  return (
    <div
      role="group"
      aria-label="Colour map by"
      className="inline-flex self-start rounded-lg border p-0.5 text-sm"
    >
      {MAP_METRICS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === metric}
          onClick={() => setMetric(option)}
          className={cn(
            "rounded-md px-3 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            option === metric
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {BUTTON_LABEL[option]}
        </button>
      ))}
    </div>
  );
}

/**
 * Statuses by icon (the markers always show them), then what the fill means: for attainment
 * the off-track hatch, for growth and share labelled stops of the scale. Muted is outside
 * the selection.
 */
function MapLegend({ metric, top }: { metric: MapMetric; top: number }) {
  const statuses = STATUS_ORDER.map((status) => ({
    label: formatStatus(status),
    swatch: <StatusIcon status={status} />,
  }));
  const swatch = (colour: string) => (
    <span className="size-3 rounded-sm" style={{ background: colour }} />
  );
  const fill =
    metric === "attainment"
      ? [
          {
            label: "Hatched: off track",
            swatch: (
              <svg width={12} height={12} className="block">
                <rect
                  width={12}
                  height={12}
                  rx={2}
                  className="fill-status-off-track"
                />
                <path
                  d="M0 6 L6 0 M0 12 L12 0 M6 12 L12 6"
                  strokeWidth={2}
                  className="stroke-background"
                />
              </svg>
            ),
          },
        ]
      : metric === "growth"
        ? [
            {
              label: `${formatPercent(-GROWTH_SPREAD, { signed: true })} or less`,
              swatch: swatch(scaleFill(metric, -GROWTH_SPREAD, top)),
            },
            {
              label: formatPercent(0, { signed: true }),
              swatch: swatch(scaleFill(metric, 0, top)),
            },
            {
              label: `${formatPercent(GROWTH_SPREAD, { signed: true })} or more`,
              swatch: swatch(scaleFill(metric, GROWTH_SPREAD, top)),
            },
          ]
        : [
            {
              label: formatPercent(0),
              swatch: swatch(scaleFill(metric, 0, top)),
            },
            {
              label: formatPercent(top),
              swatch: swatch(scaleFill(metric, top, top)),
            },
          ];
  return (
    <ChartLegend
      items={[
        ...statuses,
        ...fill,
        {
          label: "Muted: outside the selection",
          swatch: <span className="size-3 rounded-sm bg-muted" />,
        },
      ]}
    />
  );
}

function MarketTable({
  marks,
  metric,
  title,
}: {
  marks: Mark[];
  metric: MapMetric;
  title: string;
}) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-muted-foreground">
        {title}
      </caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1.5 text-left font-medium">
            Market
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            {formatMetricName(metric)}
          </th>
          <th scope="col" className="py-1.5 text-left font-medium">
            Status
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {byValue(marks).map((mark) => (
          <tr key={mark.id} className="border-b">
            <th scope="row" className="py-1.5 text-left font-normal">
              {mark.name}
            </th>
            <td className="py-1.5 text-right">
              {formatMetric(metric, mark.value)}
            </td>
            <td className="py-1.5">
              <StatusBadge status={mark.status} className="font-normal" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
