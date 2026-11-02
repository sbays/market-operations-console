"use client";

import { useDataset } from "@/data/useDataset";
import { resolveCitation } from "@/domain/citations";
import {
  formatMetricName,
  formatMetricOrMissing,
  formatPeriod,
  formatStatus,
} from "@/domain/format";
import type { Citation, Metric } from "@/domain/schema";
import { entityCode, entityLabel, statusAt, valueAt } from "@/domain/selectors";
import { useDrill } from "@/state/url";
import { cn } from "@/ui/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { focusDashboard } from "@/ui/dashboardFocus";

const CHIP =
  "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs font-medium";

/** What the tooltip checks a cited entity on: the figures the pack's answers talk about. */
const CHECKED_METRICS: Metric[] = ["revenue", "attainment", "growth"];

/**
 * One source the answer cites, checked against the data: its tooltip shows the dataset's own
 * figures for that entity and month, never the answer's, and clicking it drills the dashboard
 * there. A citation the data can't resolve says so, in the model's own words.
 */
export function SourceChip({ citation }: { citation: Citation }) {
  const dataset = useDataset();
  const drill = useDrill();
  const resolved = resolveCitation(dataset, citation);

  if (!resolved) {
    return (
      <span className={cn(CHIP, "border-dashed border-border-ai")}>
        {citation.label ?? "Unnamed source"} · not in the data
      </span>
    );
  }

  const { ref, period } = resolved;
  const status = statusAt(dataset, ref, period);
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
          {entityCode(dataset, ref)} · {formatPeriod(period)}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          Source data: {entityLabel(dataset, ref)}, {formatPeriod(period)}
          {status && <> · {formatStatus(status)}</>}
        </p>
        <ul>
          {CHECKED_METRICS.map((metric) => (
            <li key={metric}>
              {formatMetricName(metric)}:{" "}
              <span className="font-mono tabular-nums">
                {formatMetricOrMissing(
                  metric,
                  valueAt(dataset, ref, period, metric),
                )}
              </span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
