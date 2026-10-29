import { describe, expect, it } from "vitest";
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

  it("streams a matching fixture's text, then exactly one final event", async () => {
    const fixture = loadFixtures().find((f) => f.id === "germany-march-dip");
    const response = await post({
      question: "  why did germany's revenue dip in MARCH 2026? ",
    });
    const events = eventsOf(await response.text());

    const terminal = events.filter((e) => e.type !== "token");
    expect(terminal.map((e) => e.type)).toEqual(["final"]);
    expect(events.at(-1)?.type).toBe("final");
    expect(events.map((e) => (e.type === "token" ? e.text : "")).join("")).toBe(
      fixture?.response.kind === "answer" ? fixture.response.text : "?",
    );
  });

  it("abstains on a question it has no fixture for, quoting the data's range", async () => {
    const events = eventsOf(
      await (await post({ question: "What's the weather in Berlin?" })).text(),
    );
    expect(events).toEqual([
      expect.objectContaining({
        type: "abstain",
        coverage: { from: "2024-10", to: "2026-09" },
      }),
    ]);
  });

  it("stops streaming when the client goes away", async () => {
    const slow = createChatHandler({ firstTokenDelayMs: 0, tokenDelayMs: 20 });
    const controller = new AbortController();
    const response = await slow(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: "Give me a full portfolio review for Q3 2026",
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
          question: "Give me a full portfolio review for Q3 2026",
        }),
      }),
    );
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    // Give the producer time to try writing again; an enqueue after cancel would reject.
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
