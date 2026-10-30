"use client";

import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { toast } from "sonner";
import { useDataset } from "@/data/useDataset";
import { ancestorsOf, pathOf, selectionPeriod } from "@/domain/selectors";
import {
  useDrill,
  useMapMetric,
  useMode,
  useSelection,
  useSetPeriod,
  useUnknownPath,
} from "@/state/url";
import { clearHighlight } from "@/state/highlight";
import { announce } from "@/ui/announce";
import { focusDashboard } from "@/ui/dashboardFocus";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { AttainmentHeatMap } from "./AttainmentHeatMap";
import { Breadcrumb } from "./Breadcrumb";
import { CompareRadar } from "./CompareRadar";
import { DetailTable } from "./DetailTable";
import { KpiStrip } from "./KpiStrip";
import { ModeToggle } from "./ModeToggle";
import { PeriodPicker } from "./PeriodPicker";
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
  const mapMetric = useMapMetric();
  const analyst = mode === "analyst";
  const shown = selectionPeriod(dataset, period);
  const props = { dataset, selected: ref, period: shown };
  const unknownPath = useUnknownPath();
  // Telling the reader and cleaning the URL are side effects of reading a bad link, so they
  // run after render, once per bad path (clearing it ends the run).
  const announceUnknownPath = useEffectEvent(() => {
    const message =
      "That link points to something not in the data, so you're seeing the portfolio.";
    announce(message);
    // A fixed id: a render before the URL updates can't show the notice twice.
    toast(message, { id: "unknown-path" });
    unknownPath.clear();
  });
  useEffect(() => {
    if (unknownPath.path !== null) announceUnknownPath();
  }, [unknownPath.path]);

  // The period is pinned into the URL: a link without one would mean "the latest quarter
  // when opened", so a link shared today would show other figures after new data lands.
  // A missing or uncovered period is replaced by the one shown, without a history entry.
  const setPeriod = useSetPeriod();
  const pinPeriod = useEffectEvent(() => setPeriod(shown));
  useEffect(() => {
    if (period !== shown) pinPeriod();
  }, [period, shown]);

  // Escape goes up a level from inside the dashboard, or when nothing has focus (Safari
  // doesn't focus a clicked button, so focus stays on the body). A window listener, since the
  // wrapper has no interactive role. Focus elsewhere (the chat, a dialog in its portal) is
  // left alone, and so is an Escape something else already handled.
  const rootRef = useRef<HTMLDivElement>(null);
  const drill = useDrill();
  const parent = ancestorsOf(dataset, ref).at(-2);
  // An effect event reads the current parent, so the listener is added once, not per render.
  const goUp = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    if (parent === undefined || !(event.target instanceof Node)) return;
    const inDashboard =
      event.target === document.body ||
      rootRef.current?.contains(event.target) === true;
    if (!inDashboard) return;
    drill(parent);
    // The focused element may belong to the level just left; land on the new key figures.
    focusDashboard();
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => goUp(event);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  // A drill usually unmounts the hovered or focused item without its leave or blur firing, so
  // the highlight is cleared for each new selection, and when the dashboard goes away.
  const selectedPath = pathOf(dataset, ref);
  useEffect(() => {
    clearHighlight();
    return clearHighlight;
  }, [selectedPath]);
  // A failed chart is retried when the selection changes.
  const resetKey = `${pathOf(dataset, ref) ?? ""}@${shown}`;

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb dataset={dataset} selected={ref} />
        <div className="flex flex-wrap items-center gap-3">
          <PeriodPicker dataset={dataset} shown={shown} />
          <ModeToggle />
        </div>
      </div>
      <KpiStrip {...props} mode={mode} />
      <RiskMovers {...props} mode={mode} />
      <div className="grid gap-6 xl:grid-cols-2">
        {/* The map also retries when it is recoloured: one metric's failure isn't another's. */}
        <Panel label="Market map" resetKey={`${resetKey}#${mapMetric}`}>
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
