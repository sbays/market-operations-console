import { cn } from "@/ui/cn";

type Props<T extends string> = {
  /** Names the group for screen readers, e.g. "View". */
  label: string;
  options: readonly T[];
  value: T;
  onChange: (option: T) => void;
  labelOf: (option: T) => string;
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
}: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex self-start rounded-lg border p-0.5 text-sm"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            option === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {labelOf(option)}
        </button>
      ))}
    </div>
  );
}
