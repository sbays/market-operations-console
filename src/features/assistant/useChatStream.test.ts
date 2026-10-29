import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import type { StreamEvent } from "@/domain/schema";
import { server, sseResponse, type TestFrame } from "@/test/msw";
import { useChatStream } from "./useChatStream";

const QUESTION = "Why did Germany's revenue dip in March 2026?";

const citation = {
  id: 1,
  ref: { level: "market", id: "DE" },
  period: "2026-03",
  metric: "revenue",
} as const;

const final: StreamEvent = {
  type: "final",
  confidence: 0.9,
  citations: [citation],
};

function respondWith(frames: TestFrame[], options?: { delayMs?: number }) {
  server.use(http.post("*/api/chat", () => sseResponse(frames, options)));
}

function token(text: string): StreamEvent {
  return { type: "token", text };
}

describe("useChatStream", () => {
  it("starts idle", () => {
    const { result } = renderHook(() => useChatStream());
    expect(result.current.state).toEqual({ status: "idle", text: "" });
  });

  it("connects, streams and completes with the answer and its evidence", async () => {
    respondWith(
      [token("Germany "), token("fell [1"), token("] in March"), final],
      {
        delayMs: 10,
      },
    );
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
    expect(result.current.state.text).toBe("Germany fell [1] in March");
    expect(result.current.state.final).toEqual(final);
  });

  it("stops on request and keeps the partial answer", async () => {
    respondWith(
      [token("One "), token("two "), token("three "), token("four "), final],
      { delayMs: 40 },
    );
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.text).toContain("One"));
    act(() => result.current.stop());

    expect(result.current.state.status).toBe("stopped");
    const partial = result.current.state.text;
    expect(partial.length).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(result.current.state).toMatchObject({
      status: "stopped",
      text: partial,
    });
    expect(result.current.state.final).toBeUndefined();
  });

  it("treats an abstention as its own outcome, not an error", async () => {
    const abstain: StreamEvent = {
      type: "abstain",
      reason: "Beyond the data",
      coverage: { from: "2024-10", to: "2026-09" },
    };
    respondWith([abstain]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask("What will revenue be in Q1 2027?"));
    await waitFor(() => expect(result.current.state.status).toBe("abstained"));
    expect(result.current.state.abstain).toEqual(abstain);
    expect(result.current.state.error).toBeUndefined();
  });

  it("keeps the partial answer when the stream reports an error", async () => {
    respondWith([
      token("Germany's five "),
      { type: "error", message: "Timed out", retryable: true },
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany's five ",
      error: { message: "Timed out", retryable: true },
    });
  });

  it("interrupts the answer when an event breaks the contract", async () => {
    respondWith([
      token("Germany "),
      { raw: 'event: token\ndata: {"type":"token","text":42}\n\n' },
      token("never shown"),
      final,
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state).toMatchObject({
      text: "Germany ",
      error: { message: "Answer interrupted", retryable: true },
    });
  });

  it("skips event types it doesn't know", async () => {
    respondWith([
      token("Germany"),
      { raw: 'event: ping\ndata: {"type":"ping"}\n\n' },
      final,
    ]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(result.current.state.text).toBe("Germany");
  });

  it("fails visibly when the stream ends without a final event", async () => {
    respondWith([token("Germany fell")]);
    const { result } = renderHook(() => useChatStream());

    act(() => result.current.ask(QUESTION));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.state.text).toBe("Germany fell");
    expect(result.current.state.error?.retryable).toBe(true);
  });

  it("reports an HTTP failure as a retryable error, and retry asks again", async () => {
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
    expect(result.current.state.text).toBe("");

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
    expect(result.current.state).toMatchObject({
      question: QUESTION,
      text: "Recovered",
    });
    expect(calls).toBe(2);
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
    expect(result.current.state.text.startsWith("t0 t1 t2 ")).toBe(true);
    expect(renders).toBeLessThan(20);
  });
});
