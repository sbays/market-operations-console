import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import type { Citation, DoneEvent, StreamEvent } from "@/domain/schema";
import { server, sseResponse, type TestFrame } from "@/test/msw";
import { useChatStream, type ChatState } from "./useChatStream";

const QUESTION = "Why did Germany's revenue dip in March 2026?";

const citation: Citation = {
  marketId: "de",
  period: "2026-03",
  label: "Germany",
};

const final: DoneEvent = {
  type: "done",
  kind: "normal",
  citations: [citation],
  confidence: "high",
};

function respondWith(frames: TestFrame[], options?: { delayMs?: number }) {
  server.use(http.post("*/api/chat", () => sseResponse(frames, options)));
}

function token(value: string): StreamEvent {
  return { type: "token", value };
}

function textOf(state: ChatState): string {
  return state.status === "idle" ? "" : state.text;
}

describe("useChatStream", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useChatStream());
    expect(result.current.state).toEqual({ status: "idle" });
  });

  it("connects, streams and completes with the answer and its evidence", async () => {
    respondWith([token("Germany "), token("fell "), token("in March"), final], {
      delayMs: 10,
    });
    const seen: string[] = [];
    const { result } = renderHook(() => {
      const chat = useChatStream();
      if (seen.at(-1) !== chat.state.status) seen.push(chat.state.status);
      return chat;
    });

    act(() => result.current.ask(QUESTION));
    expect(result.current.state).toMatchObject({
      status: "connecting",
      question: QUESTION,
    });

    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(seen).toEqual(["idle", "connecting", "streaming", "complete"]);
    expect(result.current.state).toEqual({
      status: "complete",
      question: QUESTION,
      text: "Germany fell in March",
      done: final,
    });
  });

  it("ignores stop once the answer has finished", async () => {
    respondWith([token("Germany"), final]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    act(() => result.current.stop());

    expect(result.current.state.status).toBe("complete");
  });

  it("stops on request and keeps the partial answer", async () => {
    respondWith(
      [token("One "), token("two "), token("three "), token("four "), final],
      { delayMs: 40 },
    );
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(textOf(result.current.state)).toContain("One"));
    act(() => result.current.stop());

    expect(result.current.state.status).toBe("stopped");
    const partial = textOf(result.current.state);
    expect(partial.length).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(result.current.state).toMatchObject({
      status: "stopped",
      text: partial,
    });
    expect(result.current.state).not.toHaveProperty("done");
  });

  it("treats an abstention as its own outcome, its text the reason", async () => {
    respondWith([
      token("I can't answer that."),
      { type: "done", kind: "abstain", citations: [], confidence: "low" },
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask("Will sales grow next year?"));
    await waitFor(() => expect(result.current.state.status).toBe("abstained"));
    expect(result.current.state).toEqual({
      status: "abstained",
      question: "Will sales grow next year?",
      text: "I can't answer that.",
    });
  });

  it("completes a hedged answer, keeping its kind", async () => {
    const hedged: DoneEvent = {
      ...final,
      kind: "low_confidence",
      confidence: "low",
    };
    respondWith([token("Directionally, Germany."), hedged]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(result.current.state).toMatchObject({ done: hedged });
  });

  it("fails an answer whose done event says it failed", async () => {
    respondWith([
      token("Germany"),
      { type: "done", kind: "error", citations: [], confidence: "low" },
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany",
      error: { message: "The assistant couldn't answer." },
    });
  });

  it("fails at once on the pack's error event, before any token", async () => {
    respondWith([{ type: "error", message: "Simulated upstream failure" }]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask("force error"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "",
      error: { message: "Simulated upstream failure" },
    });
  });

  it("keeps the partial answer when the stream reports an error", async () => {
    respondWith([
      token("Germany's five "),
      { type: "error", message: "Timed out" },
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany's five ",
      error: { message: "Timed out" },
    });
  });

  it("interrupts the answer when an event breaks the contract", async () => {
    respondWith([
      token("Germany "),
      { raw: 'data: {"type":"token","value":42}\n\n' },
      token("never shown"),
      final,
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany ",
      error: { message: "Answer interrupted" },
    });
  });

  it("skips event types it doesn't know", async () => {
    respondWith([
      token("Germany"),
      { raw: 'data: {"type":"ping"}\n\n' },
      final,
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(textOf(result.current.state)).toBe("Germany");
  });

  it("fails visibly when the stream ends without a done event", async () => {
    respondWith([token("Germany fell")]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany fell",
      error: { message: "The answer ended before it was complete." },
    });
  });

  it("reports an HTTP failure in plain words and logs the status", async () => {
    server.use(
      http.post("*/api/chat", () =>
        HttpResponse.json({ error: "boom" }, { status: 503 }),
      ),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    expect(result.current.state).toMatchObject({
      error: { message: "The assistant isn't available right now." },
    });
    expect(logged).toHaveBeenCalledWith(
      "Assistant request failed:",
      expect.objectContaining({ status: 503 }),
    );
    logged.mockRestore();
  });

  it("lets an HTTP failure be retried, and retry asks again", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/chat", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ error: "boom" }, { status: 500 })
          : sseResponse([token("Recovered"), final]);
      }),
    );
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(textOf(result.current.state)).toBe("");

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(result.current.state).toMatchObject({
      question: QUESTION,
      text: "Recovered",
    });
    expect(calls).toBe(2);
  });

  it("drops the earlier answer when a new question is asked mid-stream", async () => {
    server.use(
      http.post("*/api/chat", async ({ request }) => {
        const body: unknown = await request.json();
        const first =
          typeof body === "object" &&
          body !== null &&
          "question" in body &&
          body.question === "first";
        return first
          ? sseResponse([token("old "), token("old "), token("old"), final], {
              delayMs: 30,
            })
          : sseResponse([token("new"), final], { delayMs: 60 });
      }),
    );
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask("first"));
    await waitFor(() => expect(textOf(result.current.state)).toContain("old"));
    act(() => result.current.ask("second"));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));

    expect(result.current.state).toMatchObject({
      question: "second",
      text: "new",
    });
  });

  it("logs an unexpected failure instead of hiding it", async () => {
    server.use(http.post("*/api/chat", () => HttpResponse.error()));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));

    expect(result.current.state).toMatchObject({
      error: { message: "Couldn't reach the assistant." },
    });
    expect(logged).toHaveBeenCalledWith(
      "Assistant request failed:",
      expect.any(TypeError),
    );
    logged.mockRestore();
  });

  it("re-renders per animation frame, not per token", async () => {
    const many = Array.from({ length: 200 }, (_, i) => token(`t${i} `));
    respondWith([...many, final]);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useChatStream();
    });

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(textOf(result.current.state).startsWith("t0 t1 t2 ")).toBe(true);
    expect(renders).toBeLessThan(20);
  });
});
