import { useId } from "react";
import { formatMetric, formatPeriod } from "@/domain/format";
import type { Dataset, EntityRef, PeriodRef } from "@/domain/schema";
import {
  childrenOf,
  entityLabel,
  type Mover,
  pathOf,
  topMovers,
  topRisks,
} from "@/domain/selectors";
import { linkedProps, useHighlightedPath } from "@/state/highlight";
import { type Mode, useDrill } from "@/state/url";
import { cn } from "@/ui/cn";
import { StatusBadge } from "@/ui/StatusBadge";

type Props = {
  dataset: Dataset;
  selected: EntityRef;
  period: PeriodRef;
  mode: Mode;
};

/** How many risks and movers each list shows. */
const LIST_LENGTH = 3;

/**
 * The selection's worst children, with the reason each is flagged. Analyst mode adds the
 * biggest movers. Every name drills into that child. Source data, so a solid surface.
 */
export function RiskMovers({ dataset, selected, period, mode }: Props) {
  const drill = useDrill();
  const highlighted = useHighlightedPath();
  const riskHeadingId = useId();
  const moversHeadingId = useId();
  const children = childrenOf(dataset, selected);
  if (children.length === 0) return null;

  const risks = topRisks(dataset, selected, period, LIST_LENGTH);
  const movers =
    mode === "analyst"
      ? topMovers(dataset, children, period, LIST_LENGTH)
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby={riskHeadingId}
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground"
      >
        <h2 id={riskHeadingId} className="text-base font-semibold">
          Top risks
        </h2>
        {risks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing at risk in {formatPeriod(period)}.
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {risks.map((risk) => {
              const link = linkedProps(pathOf(dataset, risk.ref), highlighted);
              return (
                <li
                  key={
                    pathOf(dataset, risk.ref) ?? entityLabel(dataset, risk.ref)
                  }
                  {...link}
                  className={cn(
                    "-mx-2 flex flex-col gap-1 rounded-md px-2 py-1",
                    link["data-linked"] && "bg-accent",
                  )}
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <DrillButton
                      name={entityLabel(dataset, risk.ref)}
                      onDrill={() => drill(risk.ref)}
                    />
                    <StatusBadge status={risk.status} />
                    <span className="text-sm font-semibold tabular-nums">
                      {formatMetric("attainment", risk.attainment)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{risk.reason}</p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {movers && (
        <section
          aria-labelledby={moversHeadingId}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground"
        >
          <h2 id={moversHeadingId} className="text-base font-semibold">
            Biggest movers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <MoverList
              label="Up"
              movers={movers.up}
              period={period}
              dataset={dataset}
              onDrill={drill}
            />
            <MoverList
              label="Down"
              movers={movers.down}
              period={period}
              dataset={dataset}
              onDrill={drill}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function MoverList({
  label,
  movers,
  period,
  dataset,
  onDrill,
}: {
  label: string;
  movers: Mover[];
  period: PeriodRef;
  dataset: Dataset;
  onDrill: (ref: EntityRef) => void;
}) {
  const labelId = useId();
  const highlighted = useHighlightedPath();
  return (
    <div className="flex flex-col gap-2">
      <h3 id={labelId} className="text-sm font-medium text-muted-foreground">
        {label}
      </h3>
      {movers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None in {formatPeriod(period)}.
        </p>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-col gap-2">
          {movers.map((mover) => {
            const link = linkedProps(pathOf(dataset, mover.ref), highlighted);
            return (
              <li
                key={
                  pathOf(dataset, mover.ref) ?? entityLabel(dataset, mover.ref)
                }
                {...link}
                className={cn(
                  "-mx-2 flex items-baseline justify-between gap-3 rounded-md px-2 text-sm",
                  link["data-linked"] && "bg-accent",
                )}
              >
                <DrillButton
                  name={entityLabel(dataset, mover.ref)}
                  onDrill={() => onDrill(mover.ref)}
                />
                <span className="font-semibold tabular-nums">
                  {formatMetric("growth", mover.growth)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DrillButton({ name, onDrill }: { name: string; onDrill: () => void }) {
  return (
    <button
      type="button"
      className="rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      onClick={onDrill}
    >
      {name}
    </button>
  );
}
