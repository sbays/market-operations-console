"use client";

/**
 * Turns the assistant stream into UI-ready state:
 *   idle → connecting → streaming → complete | abstained | stopped | error
 * Tokens are buffered and flushed once per animation frame, so a long answer doesn't
 * re-render per token. Every failure keeps whatever text already arrived.
 */
import { useEffect, useReducer, useRef } from "react";
import { ChatRequestError, streamChat } from "@/data/chatStream";
import type { StreamEvent } from "@/domain/schema";

type FinalEvent = Extract<StreamEvent, { type: "final" }>;
type AbstainEvent = Extract<StreamEvent, { type: "abstain" }>;

export type ChatStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "complete"
  | "abstained"
  | "stopped"
  | "error";

export type ChatState = {
  status: ChatStatus;
  question?: string;
  text: string;
  final?: FinalEvent;
  abstain?: AbstainEvent;
  error?: { message: string; retryable: boolean };
};

type Action =
  | { type: "start"; question: string }
  | { type: "tokens"; text: string }
  | { type: "final"; event: FinalEvent }
  | { type: "abstain"; event: AbstainEvent }
  | { type: "error"; message: string; retryable: boolean }
  | { type: "stop" };

const initialState: ChatState = { status: "idle", text: "" };

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.type) {
    case "start":
      return { status: "connecting", question: action.question, text: "" };
    case "tokens":
      return { ...state, status: "streaming", text: state.text + action.text };
    case "final":
      return { ...state, status: "complete", final: action.event };
    case "abstain":
      return { ...state, status: "abstained", abstain: action.event };
    case "error":
      return {
        ...state,
        status: "error",
        error: { message: action.message, retryable: action.retryable },
      };
    case "stop":
      return { ...state, status: "stopped" };
  }
}

const INTERRUPTED = "Answer interrupted";
const ENDED_EARLY = "The answer ended before it was complete.";
const UNREACHABLE = "Couldn't reach the assistant.";

export function useChatStream() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const controller = useRef<AbortController | null>(null);
  const buffer = useRef("");
  const frame = useRef<number | null>(null);
  const question = useRef<string | undefined>(undefined);

  /** Hands buffered tokens to React now (before a terminal state, or on stop). */
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (buffer.current) {
      dispatch({ type: "tokens", text: buffer.current });
      buffer.current = "";
    }
  };

  const append = (text: string) => {
    buffer.current += text;
    frame.current ??= requestAnimationFrame(flush);
  };

  const ask = (text: string) => {
    controller.current?.abort();
    flush();
    const current = new AbortController();
    controller.current = current;
    question.current = text;
    buffer.current = "";
    dispatch({ type: "start", question: text });

    const isCurrent = () => controller.current === current;
    /** Ends this run: aborting closes the connection and makes a later stop() a no-op. */
    const settle = (action: Action) => {
      flush();
      dispatch(action);
      current.abort();
    };
    const fail = (message: string) => {
      if (isCurrent()) settle({ type: "error", message, retryable: true });
    };

    void (async () => {
      try {
        for await (const item of streamChat(text, {
          signal: current.signal,
        })) {
          if (!isCurrent()) return;
          if (item.kind === "ignored") continue;
          if (item.kind === "invalid") {
            console.error("Assistant stream event rejected:", item.reason);
            return fail(INTERRUPTED);
          }
          const event = item.event;
          switch (event.type) {
            case "token":
              append(event.text);
              continue;
            case "final":
              return settle({ type: "final", event });
            case "abstain":
              return settle({ type: "abstain", event });
            case "error":
              return settle({
                type: "error",
                message: event.message,
                retryable: event.retryable,
              });
          }
        }
        fail(ENDED_EARLY);
      } catch (error) {
        // An abort is a stop or a newer question; both already updated the state.
        if (current.signal.aborted) return;
        if (error instanceof ChatRequestError) return fail(error.message);
        // Anything else is a network failure or our own bug: say so in the console, not just the UI.
        console.error("Assistant request failed:", error);
        fail(UNREACHABLE);
      }
    })();
  };

  const stop = () => {
    if (!controller.current || controller.current.signal.aborted) return;
    flush();
    controller.current.abort();
    dispatch({ type: "stop" });
  };

  const retry = () => {
    if (question.current !== undefined) ask(question.current);
  };

  useEffect(
    () => () => {
      controller.current?.abort();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { state, ask, stop, retry };
}
