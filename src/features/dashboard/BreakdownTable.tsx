import { formatMetricOrMissing, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, PeriodRef } from "@/domain/schema";
import {
  childLevelOf,
  childrenOf,
  entityLabel,
  pathOf,
  statusAt,
  valueAt,
} from "@/domain/selectors";
import { useId } from "react";
import {
  MAX_COMPARE,
  useCompare,
  useDrill,
  useToggleCompare,
} from "@/state/url";
import { StatusBadge } from "@/ui/StatusBadge";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

/** The level below the selection, one row per child; a row's name drills into it. */
export function BreakdownTable({ dataset, selected, period }: Props) {
  const drill = useDrill();
  const compared = useCompare();
  const toggleCompare = useToggleCompare();
  const limitId = useId();
  const comparedPaths = new Set(compared.map((ref) => pathOf(dataset, ref)));
  const full = compared.length >= MAX_COMPARE;
  const childLevel = childLevelOf(selected);
  const rows = childrenOf(dataset, selected);
  if (!childLevel || rows.length === 0) return null;

  const name = (ref: EntityRef) => entityLabel(dataset, ref);
  const figure = (ref: EntityRef, metric: "revenue" | "attainment") =>
    formatMetricOrMissing(metric, valueAt(dataset, ref, period, metric));

  return (
    <div className="flex flex-col gap-2">
      <table className="w-full text-sm">
        <caption className="pb-2 text-left text-base font-semibold">
          {name(selected)} by {childLevel}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {formatPeriod(period)}
          </span>
        </caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b">
            <th scope="col" className="py-2 text-left font-medium">
              Name
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Revenue
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Attainment
            </th>
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
              <tr key={pathOf(dataset, ref) ?? name(ref)} className="border-b">
                <th scope="row" className="py-2 text-left font-medium">
                  <button
                    type="button"
                    className="rounded-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => drill(ref)}
                  >
                    {name(ref)}
                  </button>
                </th>
                <td className="py-2 text-right tabular-nums">
                  {figure(ref, "revenue")}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {figure(ref, "attainment")}
                </td>
                <td className="py-2 pl-4">
                  {status && <StatusBadge status={status} />}
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
              </tr>
            );
          })}
        </tbody>
      </table>
      {full && (
        <p id={limitId} className="text-xs text-muted-foreground">
          You can compare up to {MAX_COMPARE}.
        </p>
      )}
    </div>
  );
}
