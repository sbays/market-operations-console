import { CircleAlert, CircleStop, RotateCw } from "lucide-react";
import { Button } from "@/ui/button";
import { AiLabel } from "./AiLabel";
import { AnswerBody } from "./AnswerBody";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SourceChip } from "./SourceChip";
import type { AnswerEvent, ChatState } from "./useChatStream";

type Props = {
  state: Exclude<ChatState, { status: "idle" }>;
  onStop: () => void;
  onRetry: () => void;
};

/** AI content always sits on its own surface and says so: never styled as source data. */
export function AnswerCard({ state, onStop, onRetry }: Props) {
  return (
    <article
      aria-label="Answer"
      className="space-y-3 rounded-lg border-l-4 border-border-ai bg-surface-ai p-4 text-surface-ai-foreground"
    >
      <AiLabel />
      {state.status === "connecting" && (
        <div className="space-y-2">
          <div aria-hidden className="space-y-2">
            <div className="h-3 w-3/4 rounded-sm bg-border-ai/40 motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded-sm bg-border-ai/40 motion-safe:animate-pulse" />
          </div>
          <p className="text-sm">Reading the data…</p>
        </div>
      )}
      <AnswerBody text={state.text} />
      {state.status === "streaming" && (
        <span
          aria-hidden
          className="block h-4 w-1.5 bg-surface-ai-foreground motion-safe:animate-pulse"
        />
      )}
      <AnswerFooter state={state} onStop={onStop} onRetry={onRetry} />
    </article>
  );
}

function AnswerFooter({ state, onStop, onRetry }: Props) {
  switch (state.status) {
    case "connecting":
    case "streaming":
      return (
        <Button variant="outline" size="sm" onClick={onStop}>
          <CircleStop aria-hidden />
          Stop
        </Button>
      );
    case "complete":
      return <Evidence done={state.done} />;
    case "error":
      return (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CircleAlert aria-hidden className="size-3.5" />
            {state.error.message}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw aria-hidden />
            Retry
          </Button>
        </div>
      );
    case "stopped":
      return (
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <CircleStop aria-hidden className="size-3.5" />
          Stopped · partial answer
        </p>
      );
    default:
      return null;
  }
}

/**
 * What a complete answer rests on: its confidence, any hedge, and its sources. Sources only
 * arrive with the final event, so a stopped or failed answer verifies nothing.
 */
function Evidence({ done }: { done: AnswerEvent }) {
  return (
    <div className="space-y-2">
      <ConfidenceBadge confidence={done.confidence} />
      {/* A hedged answer says so in words, whatever its band: the badge alone could be missed. */}
      {done.kind === "low_confidence" && (
        <p className="text-xs">
          The assistant flagged this answer as tentative: treat it as
          directional and check the sources.
        </p>
      )}
      {done.citations.length > 0 ? (
        <section aria-label="Sources" className="space-y-1">
          <h3 className="text-xs font-medium">Sources</h3>
          <ul className="flex flex-wrap gap-1.5">
            {done.citations.map((citation, index) => (
              // Citations have no id and may repeat; the list is fixed once the answer is done.
              <li key={index}>
                <SourceChip citation={citation} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-xs">
          No sources cited: nothing here is checked against the data.
        </p>
      )}
    </div>
  );
}
