"use client";

/**
 * Turns the assistant stream into UI-ready state:
 *   idle → connecting → streaming → complete | abstained | stopped | error
 * Tokens are buffered and flushed once per animation frame, so a long answer doesn't
 * re-render per token. Every failure keeps whatever text already arrived.
 */
import { useEffect, useReducer, useRef } from "react";
import { ChatRequestError, streamChat } from "@/data/chatStream";
import type { DoneEvent } from "@/domain/schema";

/** A `done` event that carries an answer, full or hedged. */
export type AnswerEvent = DoneEvent & { kind: "normal" | "low_confidence" };

type Run = { question: string; text: string };

/**
 * Each status carries exactly what it needs: a complete answer always has its evidence. An
 * abstention's reason is its streamed text; every error can be retried, since the pack's
 * errors don't say otherwise.
 */
export type ChatState =
  | { status: "idle" }
  | ({ status: "connecting" | "streaming" | "stopped" } & Run)
  | ({ status: "complete"; done: AnswerEvent } & Run)
  | ({ status: "abstained" } & Run)
  | ({ status: "error"; error: { message: string } } & Run);

export type ChatStatus = ChatState["status"];

type Action =
  | { type: "start"; question: string }
  | { type: "tokens"; text: string }
  | { type: "complete"; event: AnswerEvent }
  | { type: "abstain" }
  | { type: "error"; message: string }
  | { type: "stop" };

const initialState: ChatState = { status: "idle" };

/** Anything but `start` only applies to a run still in flight; otherwise the state stands. */
function reducer(state: ChatState, action: Action): ChatState {
  if (action.type === "start") {
    return { status: "connecting", question: action.question, text: "" };
  }
  if (state.status !== "connecting" && state.status !== "streaming") {
    return state;
  }
  const run = { question: state.question, text: state.text };
  switch (action.type) {
    case "tokens":
      return { ...run, status: "streaming", text: run.text + action.text };
    case "complete":
      return { ...run, status: "complete", done: action.event };
    case "abstain":
      return { ...run, status: "abstained" };
    case "error":
      return { ...run, status: "error", error: { message: action.message } };
    case "stop":
      return { ...run, status: "stopped" };
  }
}

const INTERRUPTED = "Answer interrupted";
const ENDED_EARLY = "The answer ended before it was complete.";
const UNREACHABLE = "Couldn't reach the assistant.";
const UNAVAILABLE = "The assistant isn't available right now.";
const FAILED = "The assistant couldn't answer.";

function isAnswer(event: DoneEvent): event is AnswerEvent {
  return event.kind === "normal" || event.kind === "low_confidence";
}

/** What a `done` event ends the run as. */
function doneAction(event: DoneEvent): Action {
  if (isAnswer(event)) return { type: "complete", event };
  return event.kind === "abstain"
    ? { type: "abstain" }
    : { type: "error", message: FAILED };
}

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
      if (isCurrent()) settle({ type: "error", message });
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
              append(event.value);
              continue;
            case "done":
              return settle(doneAction(event));
            case "error":
              return settle({ type: "error", message: event.message });
          }
        }
        fail(ENDED_EARLY);
      } catch (error) {
        // An abort is a stop or a newer question; both already updated the state.
        if (current.signal.aborted) return;
        // Say what failed in the console, not just the UI: an HTTP status, the network or our own bug.
        console.error("Assistant request failed:", error);
        fail(error instanceof ChatRequestError ? UNAVAILABLE : UNREACHABLE);
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
