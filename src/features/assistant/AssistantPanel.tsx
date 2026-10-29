"use client";

import { Send } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { ChatRequestSchema } from "@/domain/schema";
import { Button } from "@/ui/button";
import { TooltipProvider } from "@/ui/tooltip";
import { AbstentionCard } from "./AbstentionCard";
import { AnswerCard } from "./AnswerCard";
import { useChatStream, type ChatState } from "./useChatStream";

type Props = {
  /** Questions the mock can answer, offered as one-click starting points. */
  suggestedQuestions: string[];
};

/** What screen readers hear: the start and the outcome, never each token. */
function announcement(state: ChatState): string {
  switch (state.status) {
    case "idle":
      return "";
    case "connecting":
    case "streaming":
      return "Reading the data…";
    case "complete":
      return "Answer ready.";
    case "abstained":
      return "The assistant couldn't answer from the data.";
    case "stopped":
      return "Answer stopped.";
    case "error":
      return `Answer failed: ${state.error.message}`;
  }
}

export function AssistantPanel({ suggestedQuestions }: Props) {
  const headingId = useId();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const { state, ask, stop, retry } = useChatStream();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const request = ChatRequestSchema.safeParse({ question: draft });
    if (!request.success) {
      input.current?.focus();
      return;
    }
    ask(request.data.question);
    setDraft("");
  };

  return (
    <TooltipProvider>
      <aside aria-labelledby={headingId} className="flex flex-col gap-4 p-4">
        <h2 id={headingId} className="text-base font-semibold">
          Assistant
        </h2>
        <ul aria-label="Suggested questions" className="flex flex-col gap-2">
          {suggestedQuestions.map((question) => (
            <li key={question}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                onClick={() => ask(question)}
              >
                {question}
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={submit} className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            Ask about the data
          </label>
          <div className="flex gap-2">
            <input
              ref={input}
              id={inputId}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={500}
              className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            />
            <Button type="submit">
              <Send aria-hidden />
              Ask
            </Button>
          </div>
        </form>
        <p role="status" className="sr-only">
          {announcement(state)}
        </p>
        {state.status === "abstained" ? (
          <AbstentionCard abstain={state.abstain} text={state.text} />
        ) : (
          state.status !== "idle" && (
            <AnswerCard state={state} onStop={stop} onRetry={retry} />
          )
        )}
      </aside>
    </TooltipProvider>
  );
}
