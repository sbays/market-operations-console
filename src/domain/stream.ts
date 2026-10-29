/**
 * The contract's invalid-event policy (src/pack/CONTRACT.md) as one pure function:
 * unknown event types are ignored so the contract can grow; a known type with a bad
 * shape is invalid, because silently dropping it could change what an answer means.
 */
import { StreamEventSchema, type StreamEvent } from "./schema";
import type { SseFrame } from "./sse";

export type ClassifiedFrame =
  | { kind: "event"; event: StreamEvent }
  | { kind: "ignored" }
  | { kind: "invalid"; reason: string };

const KNOWN_TYPES = new Set<string>(
  StreamEventSchema.options.map((option) => option.shape.type.value),
);

function readType(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return undefined;
  }
  return typeof value.type === "string" ? value.type : undefined;
}

export function classifyFrame(frame: SseFrame): ClassifiedFrame {
  let json: unknown;
  try {
    json = JSON.parse(frame.data);
  } catch {
    return { kind: "invalid", reason: "Event data is not JSON" };
  }

  const type = readType(json);
  if (type === undefined) {
    return { kind: "invalid", reason: "Event data has no type" };
  }
  if (frame.event !== undefined && frame.event !== type) {
    return {
      kind: "invalid",
      reason: `Event name "${frame.event}" doesn't match type "${type}"`,
    };
  }
  if (!KNOWN_TYPES.has(type)) return { kind: "ignored" };

  const parsed = StreamEventSchema.safeParse(json);
  return parsed.success
    ? { kind: "event", event: parsed.data }
    : { kind: "invalid", reason: `Invalid "${type}" event` };
}
