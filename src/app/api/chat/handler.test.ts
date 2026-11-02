import { describe, expect, it, vi } from "vitest";
import { loadFixtures } from "@/data/pack";
import type { StreamEvent } from "@/domain/schema";
import { createSseParser } from "@/domain/sse";
import { classifyFrame } from "@/domain/stream";
import { createChatHandler } from "./handler";

const handler = createChatHandler({ firstTokenDelayMs: 0, tokenDelayMs: 0 });

const post = (body: unknown, signal?: AbortSignal) =>
  handler(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      ...(signal ? { signal } : {}),
    }),
  );

function eventsOf(text: string): StreamEvent[] {
  return createSseParser()
    .push(text)
    .flatMap((frame) => {
      const item = classifyFrame(frame);
      return item.kind === "event" ? [item.event] : [];
    });
}

describe("POST /api/chat", () => {
  it("rejects a body that isn't a valid chat request", async () => {
    for (const body of ["not json", { question: "   " }, { q: "hi" }]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: expect.any(String) });
    }
  });

  it("answers as an uncached event stream", async () => {
    const response = await post({ question: "anything" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe(
      "no-cache, no-transform",
    );
  });

  it("streams a matching fixture's text, then exactly one done event", async () => {
    const fixture = loadFixtures().fixtures.find((f) => f.id === "germany-dip");
    const response = await post({
      question: "Why did GERMANY's revenue dip in March?",
    });
    const events = eventsOf(await response.text());

    const terminal = events.filter((e) => e.type !== "token");
    expect(terminal).toEqual([
      {
        type: "done",
        kind: "normal",
        citations: fixture?.answer.citations,
        confidence: "high",
      },
    ]);
    expect(events.at(-1)?.type).toBe("done");
    expect(
      events.map((e) => (e.type === "token" ? e.value : "")).join(""),
    ).toBe(fixture?.answer.text);
  });

  it("answers a question no fixture matches with the pack's hedged default", async () => {
    const events = eventsOf(
      await (await post({ question: "What's the weather in Berlin?" })).text(),
    );
    expect(events.at(-1)).toEqual(
      expect.objectContaining({ type: "done", kind: "low_confidence" }),
    );
  });

  it("fails the error fixture with one error event and no tokens", async () => {
    const events = eventsOf(
      await (await post({ question: "Please force error now" })).text(),
    );
    expect(events).toEqual([
      { type: "error", message: expect.stringContaining("timed out") },
    ]);
  });

  it("stops streaming when the client goes away", async () => {
    const slow = createChatHandler({ firstTokenDelayMs: 0, tokenDelayMs: 20 });
    const controller = new AbortController();
    const response = await slow(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "Give me a full overview of the portfolio",
        }),
        signal: controller.signal,
      }),
    );
    const reader = response.body?.getReader();
    const first = await reader?.read();
    expect(first?.done).toBe(false);

    controller.abort();
    let more = 0;
    for (;;) {
      const next = await reader?.read().catch(() => ({ done: true }));
      if (!next || next.done) break;
      more += 1;
    }
    // The review streams hundreds of tokens; after abort at most one in flight arrives.
    expect(more).toBeLessThanOrEqual(1);
  });

  it("stops cleanly when the reader cancels the stream", async () => {
    const slow = createChatHandler({ firstTokenDelayMs: 0, tokenDelayMs: 5 });
    const response = await slow(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "Give me a full overview of the portfolio",
        }),
      }),
    );
    const reader = response.body?.getReader();
    await reader?.read();
    const timeout = vi.spyOn(globalThis, "setTimeout");
    await reader?.cancel();

    // Give the producer time to carry on; it should schedule no more pacing waits.
    await new Promise((resolve) => setTimeout(resolve, 50));
    const pacingWaits = timeout.mock.calls.filter(([, ms]) => ms === 5);
    timeout.mockRestore();
    expect(pacingWaits).toHaveLength(0);
  });
});
