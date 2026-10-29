"use client";

import { geoPath } from "d3-geo";
import {
  CircleCheck,
  CircleX,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
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
import { statusForAttainment, valueAt } from "@/domain/selectors";
import { useDrill } from "@/state/url";
import { ChartFrame } from "@/ui/ChartFrame";
import { cn } from "@/ui/cn";
import { useRovingIndex } from "@/ui/useRovingIndex";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

type Mark = {
  id: string;
  name: string;
  attainment: number;
  status: Status;
  inSelection: boolean;
};

// Each status has its own icon and label; the map fill and hatch only reinforce them.
const STATUS_ICONS: Record<Status, LucideIcon> = {
  "on-track": CircleCheck,
  "at-risk": TriangleAlert,
  "off-track": CircleX,
};
const STATUS_TEXT: Record<Status, string> = {
  "on-track": "text-status-on-track",
  "at-risk": "text-status-at-risk",
  "off-track": "text-status-off-track",
};
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
    const attainment = valueAt(
      dataset,
      { level: "market", id: market.id },
      period,
      "attainment",
    );
    if (attainment === undefined) return [];
    return [
      {
        id: market.id,
        name: market.name,
        attainment,
        status: statusForAttainment(attainment),
        inSelection: inSelection.has(market.id),
      },
    ];
  });
}

function byAttainment(marks: Mark[]): Mark[] {
  return [...marks].sort((a, b) => a.attainment - b.attainment);
}

/** The map's one-sentence description, built from the same figures the markers show. */
function mapSummary(marks: Mark[], period: PeriodRef): string {
  const [lowest] = byAttainment(marks);
  if (!lowest) return `No market data for ${formatPeriod(period)}.`;
  const flagged = marks.filter((m) => m.status !== "on-track").length;
  const verb = flagged === 1 ? "is" : "are";
  return `${flagged} of ${marks.length} markets ${verb} off track or at risk in ${formatPeriod(period)}; the lowest is ${lowest.name} at ${formatMetric("attainment", lowest.attainment)}.`;
}

/**
 * Markets by attainment on a world map. Each country is status-coloured when it is in the
 * selection and muted otherwise; off track is also hatched. A marker per market focuses and
 * drills to that market.
 */
export function MarketMap({ dataset, selected, period }: Props) {
  const drill = useDrill();
  const marks = marksFor(dataset, selected, period);
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

  const summary = mapSummary(marks, period);

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
              return (
                <g key={String(country.id ?? index)}>
                  <path d={d} className={className} strokeWidth={0.5} />
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
          const Icon = STATUS_ICONS[mark.status];
          return (
            <button
              key={mark.id}
              type="button"
              {...roving.itemProps(index)}
              aria-label={`${mark.name}: attainment ${formatMetric("attainment", mark.attainment)}, ${formatStatus(mark.status).toLowerCase()}`}
              onClick={() => drill({ level: "market", id: mark.id })}
              style={{ left: x, top: y }}
              className="pointer-events-auto absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <Icon
                aria-hidden="true"
                className={cn("size-4", STATUS_TEXT[mark.status])}
              />
            </button>
          );
        });
      }}
    />
  );
}

function MapLegend() {
  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-4 text-xs text-muted-foreground"
    >
      {STATUS_ORDER.map((status) => {
        const Icon = STATUS_ICONS[status];
        return (
          <li key={status} className="flex items-center gap-1.5">
            <Icon
              aria-hidden="true"
              className={cn("size-4", STATUS_TEXT[status])}
            />
            {formatStatus(status)}
          </li>
        );
      })}
      <li className="flex items-center gap-1.5">
        Off track is hatched. Muted markets are outside the selection.
      </li>
    </ul>
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
              <StatusText status={mark.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusText({ status }: { status: Status }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={cn("inline-flex items-center gap-1", STATUS_TEXT[status])}>
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      {formatStatus(status)}
    </span>
  );
}
