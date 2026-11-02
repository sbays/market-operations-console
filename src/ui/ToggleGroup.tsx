import { useId } from "react";
import { cn } from "@/ui/cn";

type Props<T extends string> = {
  /** Names the group for screen readers, e.g. "View". */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (option: T) => void;
  labelOf: (option: T) => string;
  /** Options that can't be chosen right now, each with the reason, shown under the group. */
  unavailable?: Partial<Record<T, string>>;
};

/**
 * Toggle buttons for one choice among a few: the pressed one is current. A group of
 * aria-pressed buttons, so each choice is one Tab stop and reads as "toggle button, pressed".
 */
export function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
  unavailable = {},
}: Props<T>) {
  const noteId = useId();
  const reasons = options.flatMap((option) => {
    const reason = unavailable[option];
    return reason === undefined ? [] : [reason];
  });
  return (
    <div className="flex flex-col gap-1 self-start">
      <div
        role="group"
        aria-label={label}
        className="inline-flex self-start rounded-lg border p-0.5 text-sm"
      >
        {options.map((option) => {
          const blocked = unavailable[option] !== undefined;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={option === value}
              disabled={blocked}
              aria-describedby={blocked ? noteId : undefined}
              onClick={() => onChange(option)}
              className={cn(
                "rounded-md px-3 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                option === value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground enabled:hover:bg-accent",
              )}
            >
              {labelOf(option)}
            </button>
          );
        })}
      </div>
      {reasons.length > 0 && (
        <p id={noteId} className="text-xs text-muted-foreground">
          {reasons.join(" ")}
        </p>
      )}
    </div>
  );
}
