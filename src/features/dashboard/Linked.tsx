import type { ReactNode } from "react";
import type { EntityPath } from "@/domain/schema";
import { linkedProps, useIsLinked } from "@/state/highlight";
import { cn } from "@/ui/cn";

type Props = {
  path: EntityPath | undefined;
  className?: string;
  children: ReactNode;
};

/*
 * Rows and list items that take part in linked highlighting. Each subscribes to its own
 * yes/no answer (useIsLinked), so a hover re-renders only the items whose emphasis changes.
 * Focus bubbles up from the controls inside, so keyboard users link too.
 */

/** A table row that is emphasised while its entity is highlighted anywhere. */
export function LinkedRow({ path, className, children }: Props) {
  const linked = useIsLinked(path);
  return (
    <tr
      {...linkedProps(path, linked)}
      className={cn(className, linked && "bg-accent")}
    >
      {children}
    </tr>
  );
}

/** A list item that is emphasised while its entity is highlighted anywhere. */
export function LinkedItem({ path, className, children }: Props) {
  const linked = useIsLinked(path);
  return (
    <li
      {...linkedProps(path, linked)}
      className={cn("-mx-2 rounded-md px-2", className, linked && "bg-accent")}
    >
      {children}
    </li>
  );
}
