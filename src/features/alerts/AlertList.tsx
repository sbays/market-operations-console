"use client";

import { useId } from "react";
import { useAlerts } from "@/data/alerts";
import { useDataset } from "@/data/useDataset";
import { describeAlert } from "@/domain/alert";

/** The saved alert rules, each in one line. Rules still being saved say so in text. */
export function AlertList() {
  const headingId = useId();
  const dataset = useDataset();
  const alerts = useAlerts();

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
