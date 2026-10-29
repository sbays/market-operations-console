"use client";

/**
 * The shareable selection: everything a colleague opening the link should see.
 * Views read and write these params; nothing else stores the selection.
 */
import { createParser, parseAsString, useQueryStates } from "nuqs";
import { useDataset } from "@/data/useDataset";
import {
  PeriodRefSchema,
  type EntityRef,
  type PeriodRef,
} from "@/domain/schema";
import { pathOf, refFromPath } from "@/domain/selectors";

const parseAsPeriod = createParser<PeriodRef>({
  parse: (value) => PeriodRefSchema.safeParse(value).data ?? null,
  serialize: (value) => value,
});

export const selectionParsers = {
  /** Drill path, e.g. "eu.DE.beacon" (see refFromPath). Absent means the portfolio. */
  path: parseAsString.withDefault(""),
  /** Focused period, a month ("2026-03") or a quarter ("2026-Q3"). */
  period: parseAsPeriod,
};

const PORTFOLIO: EntityRef = { level: "portfolio" };

export function useSelection(): { ref: EntityRef; period: PeriodRef | null } {
  const dataset = useDataset();
  const [{ path, period }] = useQueryStates(selectionParsers);
  // A hand-edited or stale link falls back to the portfolio instead of breaking the page.
  return { ref: refFromPath(dataset, path) ?? PORTFOLIO, period };
}

/**
 * Drills to an entity and period. Pushes history, so Back returns to the previous view.
 * An entity the data doesn't contain is ignored rather than drilled to the portfolio.
 */
export function useDrill(): (ref: EntityRef, period: PeriodRef) => void {
  const dataset = useDataset();
  const [, setSelection] = useQueryStates(selectionParsers, {
    history: "push",
  });
  return (ref, period) => {
    const path = pathOf(dataset, ref);
    if (path === undefined) return;
    // The portfolio is the default, so it leaves no path in the URL.
    void setSelection({ path: path || null, period });
  };
}
