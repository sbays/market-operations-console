import { useId } from "react";
import { formatPeriod } from "@/domain/format";
import type { Dataset, PeriodRef } from "@/domain/schema";
import { periodOptions } from "@/domain/selectors";
import { useSetPeriod } from "@/state/url";

type Props = {
  dataset: Dataset;
  /** The period every panel shows, which the dashboard keeps pinned in the URL. */
  shown: PeriodRef;
};

/**
 * Picks the period every panel shows: any quarter the data fully covers, or any month.
 * Charts can also pick a month by clicking.
 */
export function PeriodPicker({ dataset, shown }: Props) {
  const id = useId();
  const setPeriod = useSetPeriod();
  const { quarters, months } = periodOptions(dataset);
  const choices: PeriodRef[] = [...quarters, ...months];

  return (
    <div className="flex items-center gap-2 text-sm">
      <label htmlFor={id} className="font-medium">
        Period
      </label>
      <select
        id={id}
        value={shown}
        onChange={(event) => {
          const picked = choices.find(
            (period) => period === event.target.value,
          );
          if (picked !== undefined) setPeriod(picked);
        }}
        className="h-8 rounded-lg border border-input bg-background px-2.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
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
