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
import { formatMetric, formatPeriod, formatStatus } from "@/domain/format";
import type { Dataset, EntityRef, PeriodRef, Status } from "@/domain/schema";
import { isLinked } from "@/domain/highlight";
import { entityLabel, pathOf, statusAt, valueAt } from "@/domain/selectors";
import { linkedProps, useHighlightedPath } from "@/state/highlight";
import { useDrill } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { ChartLegend } from "@/ui/ChartLegend";
import { cn } from "@/ui/cn";
import { StatusBadge, StatusIcon } from "@/ui/StatusBadge";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

type Mark = {
  id: string;
  name: string;
  attainment: number;
  status: Status;
  inSelection: boolean;
};

// Each marker has its status icon and label; the map fill and hatch only reinforce them.
const STATUS_FILL: Record<Status, string> = {
  "on-track": "fill-status-on-track",
  "at-risk": "fill-status-at-risk",
  "off-track": "fill-status-off-track",
};
const STATUS_ORDER: Status[] = ["on-track", "at-risk", "off-track"];

const HATCH_SPACING = 6;

/** Attainment per dataset market over a period. Markets the data doesn't cover are left out. */
function marksFor(
  dataset: Dataset,
  selected: EntityRef,
  period: PeriodRef,
): Mark[] {
  const inSelection = marketsInSelection(dataset, selected);
  return dataset.markets.flatMap((market) => {
    const ref: EntityRef = { level: "market", id: market.id };
    const attainment = valueAt(dataset, ref, period, "attainment");
    const status = statusAt(dataset, ref, period);
    if (attainment === undefined || status === undefined) return [];
    return [
      {
        id: market.id,
        name: market.name,
        attainment,
        status,
        inSelection: inSelection.has(market.id),
      },
    ];
  });
}

function byAttainment(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => a.attainment - b.attainment);
}

/** "Germany: attainment 95.4%, at risk", the words a marker is read out as. */
function markLabel(mark: Mark): string {
  return `${mark.name}: attainment ${formatMetric("attainment", mark.attainment)}, ${formatStatus(mark.status).toLowerCase()}`;
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
): string {
  const shown = marks.filter((m) => m.inSelection);
  const when = formatPeriod(period);
  const [lowest] = byAttainment(shown);
  if (!lowest) return `No market data for ${when}.`;
  if (selected.level === "market" || selected.level === "product") {
    return `${markLabel(lowest)}, in ${when}.`;
  }
  const flagged = shown.filter((m) => m.status !== "on-track").length;
  const verb = flagged === 1 ? "is" : "are";
  const where =
    selected.level === "region" ? ` in ${entityLabel(dataset, selected)}` : "";
  return `${flagged} of ${shown.length} markets${where} ${verb} off track or at risk in ${when}; the lowest is ${lowest.name} at ${formatMetric("attainment", lowest.attainment)}.`;
}

/**
 * Markets by attainment on a world map. Each country is status-coloured when it is in the
 * selection and muted otherwise; off track is also hatched. A marker per market focuses and
 * drills to that market.
 */
export function MarketMap({ dataset, selected, period }: Props) {
  const drill = useDrill();
  const highlighted = useHighlightedPath();
  const marks = marksFor(dataset, selected, period);
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

  const summary = mapSummary(dataset, selected, marks, period);

  return (
    <ChartFrame
      title="Markets by attainment"
      summary={summary}
      height={320}
      table={<MarketTable marks={marks} />}
      legend={<MapLegend />}
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
                  : mark.inSelection
                    ? `${STATUS_FILL[mark.status]} stroke-background`
                    : "fill-muted stroke-border";
              // A linked market's country gets a heavier outline, on top of its fill.
              const linked =
                mark !== undefined &&
                isLinked(marketPath(mark.id) ?? "", highlighted);
              return (
                <g key={String(country.id ?? index)}>
                  <path
                    d={d}
                    className={cn(className, linked && "stroke-foreground")}
                    strokeWidth={linked ? 1.5 : 0.5}
                  />
                  {mark?.inSelection && mark.status === "off-track" ? (
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
            isLinked(marketPath(mark.id) ?? "", highlighted),
            item,
          );
          return (
            <button
              key={mark.id}
              type="button"
              {...item}
              {...link}
              aria-label={markLabel(mark)}
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
  );
}

/** Statuses by icon, plus the two map-only marks: the off-track hatch and muted markets. */
function MapLegend() {
  return (
    <ChartLegend
      items={[
        ...STATUS_ORDER.map((status) => ({
          label: formatStatus(status),
          swatch: <StatusIcon status={status} />,
        })),
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
        {
          label: "Muted: outside the selection",
          swatch: <span className="size-3 rounded-sm bg-muted" />,
        },
      ]}
    />
  );
}

function MarketTable({ marks }: { marks: Mark[] }) {
  return (
    <table className="w-full text-sm">
      <caption className="pb-2 text-left text-muted-foreground">
        Markets by attainment
      </caption>
      <thead className="text-xs text-muted-foreground">
        <tr className="border-b">
          <th scope="col" className="py-1.5 text-left font-medium">
            Market
          </th>
          <th scope="col" className="py-1.5 text-right font-medium">
            Attainment
          </th>
          <th scope="col" className="py-1.5 text-left font-medium">
            Status
          </th>
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {byAttainment(marks).map((mark) => (
          <tr key={mark.id} className="border-b">
            <th scope="row" className="py-1.5 text-left font-normal">
              {mark.name}
            </th>
            <td className="py-1.5 text-right">
              {formatMetric("attainment", mark.attainment)}
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
