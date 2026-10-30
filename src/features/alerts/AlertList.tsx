"use client";

import { useId } from "react";
import { useAlerts, type AlertListItem } from "@/data/alerts";
import { useDataset } from "@/data/useDataset";
import { alertMatches, describeAlert } from "@/domain/alert";
import { formatPeriod } from "@/domain/format";
import type { Dataset, PeriodRef } from "@/domain/schema";
import { entityLabel, pathOf, selectionPeriod } from "@/domain/selectors";
import { useDrill, useSelection } from "@/state/url";

/**
 * The saved alert rules, each in one line, with the markets it flags in the period the
 * dashboard shows. Rules still being saved say so in text.
 */
export function AlertList() {
  const headingId = useId();
  const dataset = useDataset();
  const alerts = useAlerts();
  const period = selectionPeriod(dataset, useSelection().period);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-base font-semibold">
        Alert rules
      </h2>
      {alerts.isPending ? (
        <p className="text-sm text-muted-foreground">Loading alert rules…</p>
      ) : alerts.isError ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load alert rules.
        </p>
      ) : alerts.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No alert rules yet.</p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {alerts.data.map((rule) => (
            <li
              key={rule.id}
              className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground"
            >
              <p className="text-sm font-medium">{rule.name}</p>
              <p className="text-sm text-muted-foreground">
                {describeAlert(rule, dataset)}
              </p>
              <Matches dataset={dataset} rule={rule} period={period} />
              {rule.pending ? (
                <p className="text-xs text-muted-foreground">Saving…</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The markets one rule flags, each a button that drills the dashboard to it. */
function Matches({
  dataset,
  rule,
  period,
}: {
  dataset: Dataset;
  rule: AlertListItem;
  period: PeriodRef;
}) {
  const drill = useDrill();
  const matches = alertMatches(dataset, rule, period);
  const when = formatPeriod(period);

  if (matches.length === 0) {
    return <p className="text-sm">No markets flagged in {when}.</p>;
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
      <p className="font-medium">
        Flags {matches.length} {matches.length === 1 ? "market" : "markets"} in{" "}
        {when}:
      </p>
      <ul className="flex flex-wrap gap-x-2">
        {matches.map((ref) => (
          <li key={pathOf(dataset, ref) ?? entityLabel(dataset, ref)}>
            <button
              type="button"
              className="rounded-sm underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              onClick={() => drill(ref)}
            >
              {entityLabel(dataset, ref)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
