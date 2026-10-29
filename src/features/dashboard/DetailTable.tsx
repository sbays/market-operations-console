import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useId, useState } from "react";
import { MAX_COMPARE } from "@/domain/compare";
import {
  formatMetricName,
  formatMetricOrMissing,
  formatPeriod,
} from "@/domain/format";
import type { Dataset, EntityRef, Metric, PeriodRef } from "@/domain/schema";
import {
  childLevelOf,
  childrenOf,
  entityLabel,
  pathOf,
  statusAt,
  valueAt,
} from "@/domain/selectors";
import { type SortDirection, type SortValue, sortRows } from "@/domain/table";
import { useCompare, useDrill, useToggleCompare } from "@/state/url";
import { StatusBadge } from "@/ui/StatusBadge";
import { LinkedRow } from "./Linked";

/** The figure columns, in the order they show. Names and status are handled separately. */
const FIGURE_COLUMNS = [
  "revenue",
  "units",
  "growth",
  "attainment",
  "share",
] as const satisfies readonly Metric[];

type FigureColumn = (typeof FIGURE_COLUMNS)[number];
type SortKey = "name" | FigureColumn;
type Sort = { key: SortKey; direction: SortDirection };

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

/**
 * The level below the selection as a table, one row per child. A row's name drills into it,
 * and each figure column sorts the rows. Source data, so the table is a solid surface.
 */
export function DetailTable({ dataset, selected, period }: Props) {
  const drill = useDrill();
  const compared = useCompare(selected);
  const toggleCompare = useToggleCompare(selected);
  const limitId = useId();
  // The sort order is a view preference, not selection, so it lives in component state and
  // not the URL. Null keeps the data's own order until a column is chosen.
  const [sort, setSort] = useState<Sort | null>(null);

  const comparedPaths = new Set(compared.map((ref) => pathOf(dataset, ref)));
  const full = compared.length >= MAX_COMPARE;
  const childLevel = childLevelOf(selected);
  const children = childrenOf(dataset, selected);
  if (!childLevel || children.length === 0) return null;

  const name = (ref: EntityRef) => entityLabel(dataset, ref);
  const sortValue = (ref: EntityRef, key: SortKey): SortValue =>
    key === "name" ? name(ref) : valueAt(dataset, ref, period, key);
  const rows = sort
    ? sortRows(children, (ref) => sortValue(ref, sort.key), sort.direction)
    : children;

  // Name starts ascending and figures start descending, the order a reader expects of each.
  // Choosing the active column again flips it.
  const sortBy = (key: SortKey) =>
    setSort((current) => {
      if (current?.key === key) {
        return {
          key,
          direction:
            current.direction === "ascending" ? "descending" : "ascending",
        };
      }
      return { key, direction: key === "name" ? "ascending" : "descending" };
    });
  const directionOf = (key: SortKey) =>
    sort?.key === key ? sort.direction : undefined;

  return (
    <div className="flex flex-col gap-2">
      {/* Eight columns don't fit narrow screens: the table scrolls, so keyboard users must be
          able to focus the scroll container (WCAG 2.1.1, axe scrollable-region-focusable). */}
      <div
        role="region"
        aria-label={`${name(selected)} by ${childLevel} table`}
        tabIndex={0}
        className="overflow-x-auto rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <table className="w-full text-sm">
          <caption className="pb-2 text-left text-base font-semibold">
            {name(selected)} by {childLevel}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · {formatPeriod(period)}
            </span>
          </caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <SortableHeader
                label="Name"
                direction={directionOf("name")}
                onSort={() => sortBy("name")}
                align="left"
              />
              {FIGURE_COLUMNS.map((metric) => (
                <SortableHeader
                  key={metric}
                  label={formatMetricName(metric)}
                  direction={directionOf(metric)}
                  onSort={() => sortBy(metric)}
                  align="right"
                />
              ))}
              <th scope="col" className="py-2 pl-4 text-left font-medium">
                Status
              </th>
              <th scope="col" className="py-2 pl-4 text-left font-medium">
                Compare
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ref) => {
              const status = statusAt(dataset, ref, period);
              const isCompared = comparedPaths.has(pathOf(dataset, ref));
              const blocked = full && !isCompared;
              return (
                <LinkedRow
                  key={pathOf(dataset, ref) ?? name(ref)}
                  path={pathOf(dataset, ref)}
                  className="border-b"
                >
                  <th scope="row" className="py-2 text-left font-medium">
                    <button
                      type="button"
                      className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      onClick={() => drill(ref)}
                    >
                      {name(ref)}
                    </button>
                  </th>
                  {FIGURE_COLUMNS.map((metric) => (
                    <td
                      key={metric}
                      className="py-2 pl-4 text-right tabular-nums"
                    >
                      {formatMetricOrMissing(
                        metric,
                        valueAt(dataset, ref, period, metric),
                      )}
                    </td>
                  ))}
                  <td className="py-2 pl-4">
                    {status ? (
                      <StatusBadge status={status} />
                    ) : (
                      <span className="text-muted-foreground">No data</span>
                    )}
                  </td>
                  <td className="py-2 pl-4">
                    <input
                      type="checkbox"
                      aria-label={`Compare ${name(ref)}`}
                      aria-describedby={blocked ? limitId : undefined}
                      checked={isCompared}
                      disabled={blocked}
                      onChange={() => toggleCompare(ref)}
                      className="size-4 accent-primary"
                    />
                  </td>
                </LinkedRow>
              );
            })}
          </tbody>
        </table>
      </div>
      {full && (
        <p id={limitId} className="text-xs text-muted-foreground">
          You can compare up to {MAX_COMPARE}.
        </p>
      )}
    </div>
  );
}

/**
 * A column header whose button sorts the table. `aria-sort` is set only on the column the rows
 * are sorted by, so a screen reader hears one order, not a list of them.
 */
function SortableHeader({
  label,
  direction,
  onSort,
  align,
}: {
  label: string;
  direction: SortDirection | undefined;
  onSort: () => void;
  align: "left" | "right";
}) {
  const Icon =
    direction === undefined
      ? ArrowUpDown
      : direction === "ascending"
        ? ArrowUp
        : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={direction}
      className={
        align === "right"
          ? "py-2 pl-4 text-right font-medium"
          : "py-2 text-left font-medium"
      }
    >
      <button
        type="button"
        onClick={onSort}
        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </th>
  );
}
