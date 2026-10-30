import { useId } from "react";
import { formatPeriod } from "@/domain/format";
import type { Dataset, PeriodRef } from "@/domain/schema";
import { latestQuarter, periodOptions } from "@/domain/selectors";
import { useSetPeriod } from "@/state/url";

type Props = {
  dataset: Dataset;
  /** The URL's period, or null when the dashboard shows its default. */
  requested: PeriodRef | null;
};

/** The empty option: no period in the URL, so the dashboard shows the latest quarter. */
const LATEST = "";

/**
 * Picks the period every panel shows: the latest quarter (the default, no URL param), any
 * quarter the data fully covers, or any month. Charts can also pick a month by clicking.
 */
export function PeriodPicker({ dataset, requested }: Props) {
  const id = useId();
  const setPeriod = useSetPeriod();
  const { quarters, months } = periodOptions(dataset);
  const choices: PeriodRef[] = [...quarters, ...months];
  const latest = latestQuarter(dataset);
  // A period the data doesn't cover falls back to the default, so the picker shows that too.
  const value = choices.find((period) => period === requested) ?? LATEST;

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="font-medium">
        Period
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          const picked = choices.find(
            (period) => period === event.target.value,
          );
          // The latest quarter is the default, so picking it by name also leaves no param:
          // one view, one URL.
          setPeriod(picked === undefined || picked === latest ? null : picked);
        }}
        className="h-8 rounded-lg border border-input bg-background px-2.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <option value={LATEST}>
          {latest ? `Latest quarter (${formatPeriod(latest)})` : "Latest"}
        </option>
        <optgroup label="Quarters">
          {quarters.map((quarter) => (
            <option key={quarter} value={quarter}>
              {formatPeriod(quarter)}
            </option>
          ))}
        </optgroup>
        <optgroup label="Months">
          {months.map((month) => (
            <option key={month} value={month}>
              {formatPeriod(month)}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}
