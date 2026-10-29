/** One MSW server for every test; add handlers per test with server.use(...). */
import { setupServer } from "msw/node";
import type { StreamEvent } from "@/domain/schema";
import { encodeSseEvent } from "@/domain/sse";

export const server = setupServer();

/** A frame as the server sends it: a contract event, or raw text for malformed cases. */
export type TestFrame = StreamEvent | { raw: string };

/** An SSE response that sends each frame `delayMs` apart (0: all in one chunk). */
export function sseResponse(
  frames: TestFrame[],
  { delayMs = 0 }: { delayMs?: number } = {},
): Response {
  const encoder = new TextEncoder();
  const text = frames.map((f) => ("raw" in f ? f.raw : encodeSseEvent(f)));
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (delayMs === 0) {
        controller.enqueue(encoder.encode(text.join("")));
      } else {
        for (const chunk of text) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          controller.enqueue(encoder.encode(chunk));
        }
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
  });
}
