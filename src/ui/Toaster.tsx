"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Where toasts appear; the styling comes from our tokens rather than sonner's defaults.
 *
 * Sonner's region is silenced, and it has no option for that, so the ref sets the attribute.
 * Its toasts arrive as a new subtree, which VoiceOver can miss, so messages are read through
 * announce() instead. The toasts and their actions stay in the accessibility tree.
 */
export function Toaster() {
  return (
    <Sonner
      ref={(section) => section?.setAttribute("aria-live", "off")}
      position="bottom-left"
      toastOptions={{
        classNames: {
          toast:
            "border bg-popover text-popover-foreground shadow-md text-sm rounded-lg",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
        },
      }}
    />
  );
}
