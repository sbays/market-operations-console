import type { ReactNode } from "react";
import { formatMetricOrMissing, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, Metric, PeriodRef } from "@/domain/schema";
import { childStatusCounts, statusAt, valueAt } from "@/domain/selectors";
import { DASHBOARD_FOCUS_ID } from "@/ui/dashboardFocus";
import { StatusBadge } from "@/ui/StatusBadge";

type Props = { dataset: Dataset; selected: EntityRef; period: PeriodRef };

/** The selection's headline figures: source data, so a solid surface and tabular figures. */
export function KpiStrip({ dataset, selected, period }: Props) {
  const figure = (metric: Metric) =>
    formatMetricOrMissing(metric, valueAt(dataset, selected, period, metric));
  const status = statusAt(dataset, selected, period);
  const counts = childStatusCounts(dataset, selected, period);
  const flagged = counts["at-risk"] + counts["off-track"];
  const judged = flagged + counts["on-track"];

  return (
    // A citation drill focuses this, so the figures that check the answer are read first.
    <section
      id={DASHBOARD_FOCUS_ID}
      tabIndex={-1}
      aria-label="Key figures"
      className="flex flex-col gap-2 rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
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
        {judged > 0 && (
          <Tile label="Off track or at risk">
            {flagged} of {judged}
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
