"use client";

import { useId, useState, type ReactNode } from "react";
import { ParentSize } from "@visx/responsive";
import { Button } from "@/ui/button";
import { cn } from "@/ui/cn";

/**
 * Width drawn at before the chart is measured. Real browsers keep it invisible until the
 * measurement lands (one frame); jsdom never measures, so tests still get points.
 */
const FALLBACK_WIDTH = 600;
const DEFAULT_HEIGHT = 240;

type Size = { width: number; height: number };

export type ChartFrameProps = {
  title: string;
  /** One sentence describing the chart; visible text and the svg's accessible name. */
  summary: string;
  /** The accessible alternative: a real <table>. */
  table: ReactNode;
  height?: number;
  /** SVG content drawn inside <svg role="img" aria-label={summary}>. */
  drawing: (size: Size) => ReactNode;
  /**
   * Focusable HTML points, absolutely positioned over the svg. role="img" makes svg
   * children presentational, so they cannot live inside it. The overlay ignores pointer
   * events, so each point opts back in with its own pointer-events class.
   */
  points?: (size: Size) => ReactNode;
  /** A key to the marks, shown under the chart in both views. */
  legend?: ReactNode;
};

export function ChartFrame({
  title,
  summary,
  table,
  height = DEFAULT_HEIGHT,
  drawing,
  points,
  legend,
}: ChartFrameProps) {
  const [showTable, setShowTable] = useState(false);
  const titleId = useId();

  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <figcaption id={titleId} className="text-base font-semibold">
            {title}
          </figcaption>
          {/* In chart mode the svg carries the summary as its name; don't read it twice. */}
          <p
            aria-hidden={showTable ? undefined : true}
            className="text-sm text-muted-foreground"
          >
            {summary}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowTable((current) => !current)}
        >
          {showTable ? "View as chart" : "View as table"}
        </Button>
      </div>
      {showTable ? (
        table
      ) : (
        <div style={{ height }} className="w-full">
          <ParentSize>
            {({ width: measured }) => {
              const width = measured > 0 ? measured : FALLBACK_WIDTH;
              const size = { width, height };
              return (
                <div className={cn("contents", measured === 0 && "invisible")}>
                  <svg
                    role="img"
                    aria-label={summary}
                    width={width}
                    height={height}
                    className="block"
                  >
                    {drawing(size)}
                  </svg>
                  {points ? (
                    <div className="pointer-events-none absolute inset-0">
                      {points(size)}
                    </div>
                  ) : null}
                </div>
              );
            }}
          </ParentSize>
        </div>
      )}
      {legend}
    </figure>
  );
}
