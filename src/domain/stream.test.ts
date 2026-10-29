import { describe, expect, it } from "vitest";
import { classifyFrame } from "./stream";

describe("classifyFrame", () => {
  it("accepts an event that matches the contract", () => {
    expect(
      classifyFrame({ event: "token", data: '{"type":"token","text":"Hi"}' }),
    ).toEqual({ kind: "event", event: { type: "token", text: "Hi" } });
  });

  it("ignores event types it doesn't know, so the contract can grow", () => {
    expect(classifyFrame({ event: "ping", data: '{"type":"ping"}' })).toEqual({
      kind: "ignored",
    });
  });

  it("flags a known type with the wrong shape as invalid", () => {
    expect(
      classifyFrame({ event: "token", data: '{"type":"token","text":42}' })
        .kind,
    ).toBe("invalid");
    expect(
      classifyFrame({
        event: "final",
        data: '{"type":"final","confidence":2,"citations":[]}',
      }).kind,
    ).toBe("invalid");
  });

  it("flags data that isn't a JSON object with a type as invalid", () => {
    expect(classifyFrame({ data: "not json" }).kind).toBe("invalid");
    expect(classifyFrame({ data: '{"text":"no type"}' }).kind).toBe("invalid");
    expect(classifyFrame({ data: "[1,2]" }).kind).toBe("invalid");
  });

  it("flags a frame whose event name contradicts its data", () => {
    expect(
      classifyFrame({ event: "final", data: '{"type":"token","text":"Hi"}' })
        .kind,
    ).toBe("invalid");
  });
});
