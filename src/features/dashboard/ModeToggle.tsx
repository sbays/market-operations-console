import { MODES, useMode, useSetMode, type Mode } from "@/state/url";
import { cn } from "@/ui/cn";

const LABELS: Record<Mode, string> = { analyst: "Analyst", exec: "Exec" };

/** Exec or analyst view of the same selection. A pair of toggle buttons; the pressed one is current. */
export function ModeToggle() {
  const mode = useMode();
  const setMode = useSetMode();
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex rounded-lg border p-0.5 text-sm"
    >
      {MODES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === mode}
          onClick={() => setMode(option)}
          className={cn(
            "rounded-md px-3 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            option === mode
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
