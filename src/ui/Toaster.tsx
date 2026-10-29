"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Where toasts appear. Sonner announces them through its own live region; the styling comes
 * from our tokens rather than sonner's defaults.
 */
export function Toaster() {
  return (
    <Sonner
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
