import { CircleSlash } from "lucide-react";
import { useId } from "react";
import { formatCoverage } from "@/domain/format";
import type { StreamEvent } from "@/domain/schema";

type Props = {
  abstain: Extract<StreamEvent, { type: "abstain" }>;
  /** Any lead-in the assistant streamed before abstaining. */
  text: string;
};

/** Declining to answer is a valid outcome, not an error: a neutral card, not a red one. */
export function AbstentionCard({ abstain, text }: Props) {
  const headingId = useId();
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
      {text && <p>{text}</p>}
      <p>{abstain.reason}</p>
      <p className="text-muted-foreground">
        The data covers {formatCoverage(abstain.coverage)}.
      </p>
    </article>
  );
}
