"use client";

import { CircleSlash } from "lucide-react";
import { useId } from "react";
import { useDataset } from "@/data/useDataset";
import { formatCoverage } from "@/domain/format";
import { coverageOf } from "@/domain/selectors";
import { AiLabel } from "./AiLabel";
import { AnswerBody } from "./AnswerBody";

/**
 * Declining to answer is a valid outcome, not an error: a neutral card, not a red one. The
 * reason is the assistant's own text; what the data covers comes from the data itself.
 */
export function AbstentionCard({ text }: { text: string }) {
  const headingId = useId();
  const dataset = useDataset();
  return (
    <article
      aria-labelledby={headingId}
      className="space-y-2 rounded-lg border bg-card p-4 text-sm text-card-foreground"
    >
      <h3
        id={headingId}
        className="flex items-center gap-1.5 text-sm font-semibold"
      >
        <CircleSlash aria-hidden className="size-4" />
        This isn&apos;t in the data
      </h3>
      {text && (
        // The reason is the assistant's own text: AI surface and label, like an answer.
        <div className="space-y-2 rounded-md border-l-4 border-border-ai bg-surface-ai p-3 text-surface-ai-foreground">
          <AiLabel />
          <AnswerBody text={text} />
        </div>
      )}
      <p className="text-muted-foreground">
        The data covers {formatCoverage(coverageOf(dataset))}.
      </p>
    </article>
  );
}
