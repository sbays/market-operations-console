"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { useDataset } from "@/data/useDataset";
import { ancestorsOf, pathOf, selectionPeriod } from "@/domain/selectors";
import { useDrill, useMode, useSelection, useUnknownPath } from "@/state/url";
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
  const unknownPath = useUnknownPath();
  // Telling the reader and cleaning the URL are side effects of reading a bad link, so they
  // run after render. Clearing the path makes this false, so it runs once per bad link.
  useEffect(() => {
    if (unknownPath.path === null) return;
    toast(
      "That link points to something not in the data, so you're seeing the portfolio.",
      // A fixed id: a render before the URL updates can't show the notice twice.
      { id: "unknown-path" },
    );
    unknownPath.clear();
  }, [unknownPath]);
  // Escape goes up a level, from anywhere inside the dashboard. A window listener rather than
  // a handler on the wrapper, which has no interactive role. Focus outside the dashboard (the
  // chat, an open dialog in its portal) is left alone, and so is an Escape already handled.
  const rootRef = useRef<HTMLDivElement>(null);
  const drill = useDrill();
  const parent = ancestorsOf(dataset, ref).at(-2);
  useEffect(() => {
    if (parent === undefined) return;
    const goUp = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (!(event.target instanceof Node)) return;
      if (!rootRef.current?.contains(event.target)) return;
      drill(parent);
    };
    window.addEventListener("keydown", goUp);
    return () => window.removeEventListener("keydown", goUp);
  }, [parent, drill]);
  // A failed chart is retried when the selection changes.
  const resetKey = `${pathOf(dataset, ref) ?? ""}@${shown}`;

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
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
          <Panel label="Compare chart" resetKey={resetKey}>
            <CompareRadar {...props} />
          </Panel>
          {/* Full width: eight columns don't fit beside another panel. */}
          <DetailTable {...props} />
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
