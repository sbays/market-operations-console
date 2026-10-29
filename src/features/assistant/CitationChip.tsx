"use client";

import { use } from "react";
import { useDataset } from "@/data/useDataset";
import { formatMetric, formatMetricName, formatPeriod } from "@/domain/format";
import type { Citation } from "@/domain/schema";
import { entityCode, entityLabel, pathOf, valueAt } from "@/domain/selectors";
import { useDrill } from "@/state/url";
import { cn } from "@/ui/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { focusDashboard } from "@/ui/dashboardFocus";
import { EvidenceContext } from "./citations";

const CHIP =
  "mx-0.5 inline-flex items-center rounded-sm border px-1 align-baseline text-xs font-medium";
const UNCHECKED = cn(CHIP, "border-dashed border-border-ai");

/** A citation marker [n]: pending while streaming, then a chip checked against the data. */
export function CitationChip({ id }: { id: number }) {
  const evidence = use(EvidenceContext);
  if (!evidence.settled) {
    return (
      <span className={UNCHECKED}>
        <span aria-hidden>{id}</span>
        <span className="sr-only">Citation {id}, checking the source</span>
      </span>
    );
  }
  const citation = evidence.citations.find((c) => c.id === id);
  if (!citation) return <span className={UNCHECKED}>[{id}] Unverified</span>;
  return <ResolvedChip citation={citation} />;
}

function ResolvedChip({ citation }: { citation: Citation }) {
  const dataset = useDataset();
  const drill = useDrill();
  const { ref, period, metric } = citation;
  const value = valueAt(dataset, ref, period, metric);
  const label = `${entityCode(dataset, ref)} · ${formatPeriod(period)} · ${formatMetricName(metric)}`;

  // Nothing to check or drill to: say so instead of drilling somewhere else.
  if (value === undefined || pathOf(dataset, ref) === undefined) {
    return <span className={UNCHECKED}>{label} · not in the data</span>;
  }

  const source = `${entityLabel(dataset, ref)}, ${formatPeriod(period)}, ${formatMetricName(metric)}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            CHIP,
            "cursor-pointer border-border bg-card text-card-foreground hover:bg-accent",
          )}
          onClick={() => {
            drill(ref, period);
            focusDashboard();
          }}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Source data: {source}:{" "}
        <span className="font-mono tabular-nums">
          {formatMetric(metric, value)}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
