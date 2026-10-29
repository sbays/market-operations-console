import { Sparkles } from "lucide-react";

/** Marks content the assistant wrote, so it is never mistaken for source data. */
export function AiLabel() {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium">
      <Sparkles aria-hidden className="size-3.5" />
      AI-generated · verify with sources
    </p>
  );
}
