/**
 * Server-Sent Events framing, per the WHATWG event-stream format, for our POST-based stream
 * (EventSource can't send a body). Pure: no I/O, so it's tested byte by byte.
 */
import type { StreamEvent } from "./schema";

export type SseFrame = { event?: string; data: string };

export type SseParser = {
  /** Feed the next decoded chunk; returns every frame it completed. */
  push(chunk: string): SseFrame[];
};

export function createSseParser(): SseParser {
  let buffer = "";
  let event: string | undefined;
  let data: string[] = [];

  function dispatch(frames: SseFrame[]) {
    if (data.length > 0) {
      frames.push({
        ...(event === undefined ? {} : { event }),
        data: data.join("\n"),
      });
    }
    event = undefined;
    data = [];
  }

  function processLine(line: string, frames: SseFrame[]) {
    if (line === "") return dispatch(frames);
    if (line.startsWith(":")) return;

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "data") data.push(value);
    else if (field === "event") event = value;
  }

  return {
    push(chunk) {
      buffer += chunk;
      const frames: SseFrame[] = [];
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer);
        if (!match) break;
        // A trailing "\r" may be the first half of "\r\n": wait for the next chunk.
        if (match[0] === "\r" && match.index === buffer.length - 1) break;
        processLine(buffer.slice(0, match.index), frames);
        buffer = buffer.slice(match.index + match[0].length);
      }
      return frames;
    },
  };
}

/** One event as one frame. JSON.stringify never emits a raw newline, so one data line suffices. */
export function encodeSseEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
