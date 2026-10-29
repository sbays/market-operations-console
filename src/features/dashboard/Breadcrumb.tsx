import { ChevronRight } from "lucide-react";
import type { Dataset, EntityRef } from "@/domain/schema";
import {
  ancestorsOf,
  entityCode,
  entityName,
  pathOf,
} from "@/domain/selectors";
import { useDrill } from "@/state/url";

type Props = { dataset: Dataset; selected: EntityRef };

/** Where the dashboard is, and the way back up: each ancestor drills up a level. */
export function Breadcrumb({ dataset, selected }: Props) {
  const drill = useDrill();
  const trail = ancestorsOf(dataset, selected);

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {trail.map((ref, index) => {
          const name = entityName(dataset, ref) ?? entityCode(dataset, ref);
          const current = index === trail.length - 1;
          return (
            <li
              key={pathOf(dataset, ref) ?? index}
              className="flex items-center gap-1"
            >
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className="size-3.5 text-muted-foreground"
                />
              )}
              {current ? (
                <span aria-current="page" className="font-semibold">
                  {name}
                </span>
              ) : (
                <button
                  type="button"
                  className="rounded-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => drill(ref)}
                >
                  {name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
