import { describe, expect, it } from "vitest";
import type { StreamEvent } from "./schema";
import { createSseParser, encodeSseEvent, type SseFrame } from "./sse";

function parseAll(chunks: string[]): SseFrame[] {
  const parser = createSseParser();
  return chunks.flatMap((chunk) => parser.push(chunk));
}

describe("createSseParser", () => {
  it("reads one frame", () => {
    expect(parseAll(['event: token\ndata: {"text":"Hi"}\n\n'])).toEqual([
      { event: "token", data: '{"text":"Hi"}' },
    ]);
  });

  it("reads the same frames however the stream is split", () => {
    const stream =
      'event: token\ndata: {"text":"Ger"}\n\nevent: final\ndata: {"confidence":0.9}\n\n';
    const expected = [
      { event: "token", data: '{"text":"Ger"}' },
      { event: "final", data: '{"confidence":0.9}' },
    ];
    for (let cut = 0; cut <= stream.length; cut++) {
      expect(
        parseAll([stream.slice(0, cut), stream.slice(cut)]),
        `cut ${cut}`,
      ).toEqual(expected);
    }
    expect(parseAll([...stream])).toEqual(expected);
  });

  it("accepts CRLF and CR line endings, even when CRLF is split", () => {
    // A lone CR at the end of a chunk may be half a CRLF, so "b" completes once more arrives.
    expect(parseAll(["data: a\r\n\r\ndata: b\r\r", "data: c\n\n"])).toEqual([
      { data: "a" },
      { data: "b" },
      { data: "c" },
    ]);
    expect(parseAll(["data: a\r", "\n\r", "\n"])).toEqual([{ data: "a" }]);
  });

  it("joins multi-line data and strips one space after the colon", () => {
    expect(parseAll(["data: one\ndata:two\ndata:  three\n\n"])).toEqual([
      { data: "one\ntwo\n three" },
    ]);
  });

  it("ignores comments and frames without data", () => {
    expect(parseAll([": keep-alive\n\nevent: token\n\ndata: x\n\n"])).toEqual([
      { data: "x" },
    ]);
  });

  it("holds back a frame until its blank line arrives", () => {
    const parser = createSseParser();
    expect(parser.push("data: partial\n")).toEqual([]);
    expect(parser.push("\n")).toEqual([{ data: "partial" }]);
  });
});

describe("encodeSseEvent", () => {
  it("writes a frame the parser reads back", () => {
    const events: StreamEvent[] = [
      { type: "token", text: "Line one\nline two [1" },
      {
        type: "final",
        confidence: 0.82,
        citations: [
          {
            id: 1,
            ref: { level: "market", id: "DE" },
            period: "2026-03",
            metric: "revenue",
          },
        ],
      },
      {
        type: "abstain",
        reason: "Beyond the data",
        coverage: { from: "2024-10", to: "2026-09" },
      },
      { type: "error", message: "Timed out", retryable: true },
    ];
    for (const event of events) {
      const [frame] = parseAll([encodeSseEvent(event)]);
      expect(frame?.event).toBe(event.type);
      expect(JSON.parse(frame?.data ?? "")).toEqual(event);
    }
  });
});
