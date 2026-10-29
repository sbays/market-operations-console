"use client";

/**
 * The shareable selection: everything a colleague opening the link should see.
 * Views read and write these params; nothing else stores the selection.
 */
import {
  createParser,
  parseAsArrayOf,
  parseAsString,
  useQueryState,
  useQueryStates,
} from "nuqs";
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
 * Drills to an entity, and to a period when one is given (otherwise the period stays).
 * Pushes history, so Back returns to the previous view. An entity the data doesn't contain
 * is ignored rather than drilled to the portfolio.
 */
export function useDrill(): (ref: EntityRef, period?: PeriodRef) => void {
  const dataset = useDataset();
  const [, setSelection] = useQueryStates(selectionParsers, {
    history: "push",
  });
  return (ref, period) => {
    const path = pathOf(dataset, ref);
    if (path === undefined) return;
    // The portfolio is the default, so it leaves no path in the URL.
    void setSelection(
      period === undefined
        ? { path: path || null }
        : { path: path || null, period },
    );
  };
}

/** Focuses a period. Replaces history: stepping through periods shouldn't flood Back. */
export function useSetPeriod(): (period: PeriodRef) => void {
  const [, setSelection] = useQueryStates(selectionParsers, {
    history: "replace",
  });
  return (period) => {
    void setSelection({ period });
  };
}

/** The most entities the radar compares at once. */
export const MAX_COMPARE = 4;

/** Entities to compare, as drill paths: "eu.DE,eu.FR". Same format as `path`. */
const compareParser = parseAsArrayOf(parseAsString, ",").withDefault([]);

/** The compared entities that the data contains, at most MAX_COMPARE. */
export function useCompare(): EntityRef[] {
  const dataset = useDataset();
  const [paths] = useQueryState("compare", compareParser);
  return paths
    .map((path) => refFromPath(dataset, path))
    .filter((ref) => ref !== undefined)
    .slice(0, MAX_COMPARE);
}

/**
 * Adds an entity to the comparison, or removes it if it's there. Ignores additions past
 * MAX_COMPARE. Replaces history: picking what to compare isn't a navigation.
 */
export function useToggleCompare(): (ref: EntityRef) => void {
  const dataset = useDataset();
  const [paths, setPaths] = useQueryState(
    "compare",
    compareParser.withOptions({ history: "replace" }),
  );
  return (ref) => {
    const path = pathOf(dataset, ref);
    if (path === undefined) return;
    if (paths.includes(path)) {
      const rest = paths.filter((p) => p !== path);
      void setPaths(rest.length > 0 ? rest : null);
    } else if (paths.length < MAX_COMPARE) {
      void setPaths([...paths, path]);
    }
  };
}
