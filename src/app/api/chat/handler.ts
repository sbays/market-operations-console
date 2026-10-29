/**
 * The mock assistant: matches the question to a fixture and streams it as SSE, paced so the
 * connecting and streaming states are visible. A mock by design (CLAUDE.md): no model calls.
 */
import { loadDataset, loadFixtures } from "@/data/pack";
import { fixtureEvents, matchFixture } from "@/domain/fixtures";
import { ChatRequestSchema } from "@/domain/schema";
import { coverageOf } from "@/domain/selectors";
import { encodeSseEvent } from "@/domain/sse";

export type ChatHandlerOptions = {
  /** Pause before the first event, so "connecting" is visible. */
  firstTokenDelayMs: number;
  /** Pause between events while streaming. */
  tokenDelayMs: number;
};

/** Resolves after `ms`, or straight away once `signal` aborts. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
  });
}

export function createChatHandler(options: ChatHandlerOptions) {
  return async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Body must be JSON" }, { status: 400 });
    }
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Expected { question: string } (1–500 characters)" },
        { status: 400 },
      );
    }

    const events = fixtureEvents(
      matchFixture(loadFixtures(), parsed.data.question),
      coverageOf(loadDataset()),
    );
    // Stop on either a client abort or the body being cancelled.
    const cancelled = new AbortController();
    const signal = AbortSignal.any([request.signal, cancelled.signal]);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const [index, event] of events.entries()) {
          await wait(
            index === 0 ? options.firstTokenDelayMs : options.tokenDelayMs,
            signal,
          );
          if (signal.aborted) break;
          controller.enqueue(encoder.encode(encodeSseEvent(event)));
        }
        if (!cancelled.signal.aborted) controller.close();
      },
      cancel() {
        cancelled.abort();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "x-accel-buffering": "no",
      },
    });
  };
}
