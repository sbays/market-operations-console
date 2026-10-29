"use client";

import { useDataset } from "@/data/useDataset";
import { selectionPeriod } from "@/domain/selectors";
import { useSelection } from "@/state/url";
import { Breadcrumb } from "./Breadcrumb";
import { BreakdownTable } from "./BreakdownTable";
import { KpiStrip } from "./KpiStrip";
import { TrendChart } from "./TrendChart";

/**
 * The dashboard for the selection in the URL. Every panel derives from the same entity and
 * period, and writes back only through URL state, so the panels never talk to each other.
 */
export function Dashboard() {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  const shown = selectionPeriod(dataset, period);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb dataset={dataset} selected={ref} />
      <KpiStrip dataset={dataset} selected={ref} period={shown} />
      <TrendChart dataset={dataset} selected={ref} period={shown} />
      <BreakdownTable dataset={dataset} selected={ref} period={shown} />
    </div>
  );
}
