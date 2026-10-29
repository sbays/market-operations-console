import type { ReactNode } from "react";
import { formatMetric, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, Metric, PeriodRef } from "@/domain/schema";
import { childrenOf, statusAt, valueAt } from "@/domain/selectors";
import { StatusBadge } from "@/ui/StatusBadge";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

const NO_DATA = "No data";

/** The selection's headline figures: source data, so a solid surface and tabular figures. */
export function KpiStrip({ dataset, selected, period }: Props) {
  const figure = (metric: Metric) => {
    const value = valueAt(dataset, selected, period, metric);
    return value === undefined ? NO_DATA : formatMetric(metric, value);
  };
  const status = statusAt(dataset, selected, period);
  const children = childrenOf(dataset, selected);
  const flagged = children.filter(
    (child) => statusAt(dataset, child, period) !== "on-track",
  ).length;

  return (
    <section aria-label="Key figures" className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Source data · {formatPeriod(period)}
      </p>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Revenue">{figure("revenue")}</Tile>
        <Tile label="Forecast attainment">
          {figure("attainment")}
          {status && <StatusBadge status={status} />}
        </Tile>
        <Tile label="Growth vs prior year">{figure("growth")}</Tile>
        {children.length > 0 && (
          <Tile label="Off track or at risk">
            {flagged} of {children.length}
          </Tile>
        )}
      </dl>
    </section>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-2 text-xl font-semibold tabular-nums">
        {children}
      </dd>
    </div>
  );
}
