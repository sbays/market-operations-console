"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { useDataset } from "@/data/useDataset";
import { pathOf, selectionPeriod } from "@/domain/selectors";
import { useMode, useSelection } from "@/state/url";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { AttainmentHeatMap } from "./AttainmentHeatMap";
import { Breadcrumb } from "./Breadcrumb";
import { CompareRadar } from "./CompareRadar";
import { DetailTable } from "./DetailTable";
import { KpiStrip } from "./KpiStrip";
import { ModeToggle } from "./ModeToggle";
import { RiskMovers } from "./RiskMovers";
import { TrendChart } from "./TrendChart";

// The world TopoJSON is the largest asset on the page: load it after the rest of the
// dashboard. The map measures its container anyway, so it can't draw on the server.
const MarketMap = dynamic(
  () => import("./MarketMap").then((module) => module.MarketMap),
  { ssr: false, loading: () => <PanelSkeleton /> },
);

/**
 * The dashboard for the selection in the URL. Every panel derives from the same entity and
 * period, and writes back only through URL state, so the panels never talk to each other.
 * Each chart has its own error boundary, so one failing chart leaves the rest working.
 */
export function Dashboard() {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  const mode = useMode();
  const analyst = mode === "analyst";
  const shown = selectionPeriod(dataset, period);
  const props = { dataset, selected: ref, period: shown };
  // A failed chart is retried when the selection changes.
  const resetKey = `${pathOf(dataset, ref) ?? ""}@${shown}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb dataset={dataset} selected={ref} />
        <ModeToggle />
      </div>
      <KpiStrip {...props} mode={mode} />
      <RiskMovers {...props} mode={mode} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel label="Market map" resetKey={resetKey}>
          <MarketMap {...props} />
        </Panel>
        <Panel label="Trend chart" resetKey={resetKey}>
          <TrendChart {...props} mode={mode} />
        </Panel>
      </div>
      {/* Exec hides the dense panels; analysts get the full grid, radar and table. */}
      {analyst && (
        <>
          <Panel label="Heat map" resetKey={resetKey}>
            <AttainmentHeatMap {...props} />
          </Panel>
          <div className="grid items-start gap-6 xl:grid-cols-2">
            <Panel label="Compare chart" resetKey={resetKey}>
              <CompareRadar {...props} />
            </Panel>
            <DetailTable {...props} />
          </div>
        </>
      )}
    </div>
  );
}

function Panel({
  label,
  resetKey,
  children,
}: {
  label: string;
  resetKey: string;
  children: ReactNode;
}) {
  return (
    <ErrorBoundary label={label} resetKey={resetKey}>
      <div className="min-w-0">{children}</div>
    </ErrorBoundary>
  );
}

function PanelSkeleton() {
  return <div aria-hidden className="h-80 rounded-lg bg-muted" />;
}
