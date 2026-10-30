"use client";

/**
 * The shareable selection: everything a colleague opening the link should see.
 * Views read and write these params; nothing else stores the selection.
 */
import {
  createParser,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useDataset } from "@/data/useDataset";
import { comparedRefs, toggleCompared } from "@/domain/compare";
import {
  PeriodRefSchema,
  type EntityRef,
  type PeriodRef,
} from "@/domain/schema";
import {
  isPortfolioPath,
  pathOf,
  PORTFOLIO_PATH,
  refFromPath,
} from "@/domain/selectors";

const parseAsPeriod = createParser<PeriodRef>({
  parse: (value) => PeriodRefSchema.safeParse(value).data ?? null,
  serialize: (value) => value,
});

export const selectionParsers = {
  /** Drill path, e.g. "eu.DE.beacon" (see refFromPath). Absent means the portfolio. */
  path: parseAsString.withDefault(PORTFOLIO_PATH),
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
 * The URL's `path` when the data doesn't contain it (a hand-edited or stale link), else null,
 * and a way to drop it from the URL. useSelection already shows the portfolio for it.
 */
export function useUnknownPath(): { path: string | null; clear: () => void } {
  const dataset = useDataset();
  const [path, setPath] = useQueryState(
    "path",
    selectionParsers.path.withOptions({ history: "replace" }),
  );
  return {
    path: refFromPath(dataset, path) === undefined ? path : null,
    clear: () => {
      void setPath(null);
    },
  };
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
    const pathParam = isPortfolioPath(path) ? null : path;
    void setSelection(
      period === undefined ? { path: pathParam } : { path: pathParam, period },
    );
  };
}

/**
 * Focuses a period, or with null returns to the default (the latest quarter, no param).
 * Replaces history: stepping through periods shouldn't flood Back.
 */
export function useSetPeriod(): (period: PeriodRef | null) => void {
  const [, setSelection] = useQueryStates(selectionParsers, {
    history: "replace",
  });
  return (period) => {
    void setSelection({ period });
  };
}

/** Entities to compare, as drill paths: "eu.DE,eu.FR". Same format as `path`. */
const compareParser = parseAsArrayOf(parseAsString, ",").withDefault([]);

/** The entities the radar compares under a selection (see comparedRefs). */
export function useCompare(selected: EntityRef): EntityRef[] {
  const dataset = useDataset();
  const [paths] = useQueryState("compare", compareParser);
  return comparedRefs(dataset, selected, paths);
}

/**
 * Ticks or unticks an entity, writing the whole comparison so the defaults survive the first
 * tick. Replaces history: picking what to compare isn't a navigation.
 */
export function useToggleCompare(
  selected: EntityRef,
): (ref: EntityRef) => void {
  const dataset = useDataset();
  const compared = useCompare(selected);
  const [, setPaths] = useQueryState(
    "compare",
    compareParser.withOptions({ history: "replace" }),
  );
  return (ref) => {
    const paths = toggleCompared(dataset, compared, ref);
    void setPaths(paths.length > 0 ? paths : null);
  };
}

export const MODES = ["analyst", "exec"] as const;
export type Mode = (typeof MODES)[number];

/** Analyst shows every panel; exec hides the dense ones. A bare link is analyst. */
const modeParser = parseAsStringLiteral(MODES).withDefault("analyst");

export function useMode(): Mode {
  const [mode] = useQueryState("mode", modeParser);
  return mode;
}

/** Switches mode. Replaces history: it's a view of the same selection, not a navigation. */
export function useSetMode(): (mode: Mode) => void {
  const [, setMode] = useQueryState(
    "mode",
    modeParser.withOptions({ history: "replace" }),
  );
  return (mode) => {
    // The default leaves no param, so analyst links stay short.
    void setMode(mode === "analyst" ? null : mode);
  };
}

/**
 * `?fail=1` makes the mock refuse alert saves, so reviewers and tests can see the rollback.
 * A test switch, read here so the data layer never parses the URL.
 */
export function useFailSaves(): boolean {
  const [fail] = useQueryState("fail", parseAsInteger);
  return fail === 1;
}
