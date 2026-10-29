import { CircleAlert, CircleStop, RotateCw, Sparkles } from "lucide-react";
import { confidenceBand } from "@/domain/selectors";
import { Button } from "@/ui/button";
import { AnswerBody } from "./AnswerBody";
import { ConfidenceBadge } from "./ConfidenceBadge";
import type { ChatState } from "./useChatStream";

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
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Sparkles aria-hidden className="size-3.5" />
        AI-generated · verify with sources
      </p>
      {state.status === "connecting" && (
        <div className="space-y-2">
          <div aria-hidden className="space-y-2">
            <div className="h-3 w-3/4 rounded-sm bg-border-ai/40 motion-safe:animate-pulse" />
            <div className="h-3 w-1/2 rounded-sm bg-border-ai/40 motion-safe:animate-pulse" />
          </div>
          <p className="text-sm">Reading the data…</p>
        </div>
      )}
      <AnswerBody
        text={state.text}
        citations={
          state.status === "complete" ? state.final.citations : undefined
        }
      />
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
      return (
        <div className="space-y-1.5">
          <ConfidenceBadge confidence={state.final.confidence} />
          {state.final.uncertainty &&
            confidenceBand(state.final.confidence) === "low" && (
              <p className="text-xs">
                Why it&apos;s uncertain: {state.final.uncertainty}
              </p>
            )}
        </div>
      );
    case "error":
      return (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <CircleAlert aria-hidden className="size-3.5" />
            {state.error.message}
          </p>
          {state.error.retryable && (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCw aria-hidden />
              Retry
            </Button>
          )}
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
