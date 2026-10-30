import { MODES, useMode, useSetMode, type Mode } from "@/state/url";
import { ToggleGroup } from "@/ui/ToggleGroup";

const LABELS: Record<Mode, string> = { analyst: "Analyst", exec: "Exec" };

/** Exec or analyst view of the same selection. */
export function ModeToggle() {
  return (
    <ToggleGroup
      label="View"
      options={MODES}
      value={useMode()}
      onChange={useSetMode()}
      labelOf={(mode) => LABELS[mode]}
    />
  );
}
