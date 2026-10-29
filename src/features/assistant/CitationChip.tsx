"use client";

import { use } from "react";
import { useDataset } from "@/data/useDataset";
import { formatMetric, formatMetricName, formatPeriod } from "@/domain/format";
import type { Citation, Dataset, EntityRef } from "@/domain/schema";
import { entityName, valueAt } from "@/domain/selectors";
import { useDrill } from "@/state/url";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/tooltip";
import { CitationsContext } from "./citations";

const CHIP =
  "mx-0.5 inline-flex items-center rounded-sm border px-1 align-baseline text-xs font-medium";

/** Short entity label for a chip: market codes as the data writes them, names otherwise. */
function chipEntity(dataset: Dataset, ref: EntityRef): string {
  if (ref.level === "market") return ref.id;
  if (ref.level === "product") {
    const product = dataset.products.find((p) => p.id === ref.id);
    return `${ref.marketId} ${product?.name ?? ref.id}`;
  }
  return entityName(dataset, ref) ?? ref.level;
}

/** A citation marker [n]: pending while streaming, then a chip checked against the data. */
export function CitationChip({ id }: { id: number }) {
  const citations = use(CitationsContext);
  if (citations === undefined) {
    return (
      <span className={`${CHIP} border-dashed border-border-ai`}>
        <span aria-hidden>{id}</span>
        <span className="sr-only">Citation {id}, checking the source</span>
      </span>
    );
  }
  const citation = citations.find((c) => c.id === id);
  if (!citation) {
    return (
      <span className={`${CHIP} border-dashed border-border-ai`}>
        [{id}] Unverified
      </span>
    );
  }
  return <ResolvedChip citation={citation} />;
}

function ResolvedChip({ citation }: { citation: Citation }) {
  const dataset = useDataset();
  const drill = useDrill();
  const { ref, period, metric } = citation;
  const value = valueAt(dataset, ref, period, metric);
  const label = `${chipEntity(dataset, ref)} · ${formatPeriod(period)} · ${formatMetricName(metric)}`;
  const source = `${entityName(dataset, ref) ?? chipEntity(dataset, ref)}, ${formatPeriod(period)}, ${formatMetricName(metric)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`${CHIP} cursor-pointer border-border bg-card text-card-foreground hover:bg-accent`}
          onClick={() => drill(ref, period)}
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        Source data: {source}:{" "}
        <span className="font-mono tabular-nums">
          {value === undefined
            ? "not in the data"
            : formatMetric(metric, value)}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
