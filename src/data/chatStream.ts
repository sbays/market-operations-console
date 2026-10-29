/**
 * The client side of src/pack/CONTRACT.md: POSTs a question and yields each frame already
 * classified against the contract. The only place the assistant touches the network.
 */
import { createSseParser } from "@/domain/sse";
import { classifyFrame, type ClassifiedFrame } from "@/domain/stream";

export class ChatRequestError extends Error {
  override name = "ChatRequestError";
}

export async function* streamChat(
  question: string,
  { signal }: { signal: AbortSignal },
): AsyncGenerator<ClassifiedFrame> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  if (!response.ok) {
    throw new ChatRequestError(`The assistant returned ${response.status}`);
  }
  if (!response.headers.get("content-type")?.startsWith("text/event-stream")) {
    throw new ChatRequestError("The assistant didn't send an event stream");
  }
  if (!response.body) throw new ChatRequestError("The response had no body");

  const parser = createSseParser();
  const decoder = new TextDecoder();
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      for (const frame of parser.push(
        decoder.decode(value, { stream: true }),
      )) {
        yield classifyFrame(frame);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
