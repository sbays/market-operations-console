/**
 * How the mock assistant answers, per the starter pack (src/pack/CONTRACT.md): keyword
 * matching against the fixtures, and turning a fixture into stream events. Pure; the route
 * adds pacing.
 */
import type { Fixture, Fixtures, StreamEvent } from "./schema";

/**
 * The first fixture, in order, with a keyword inside the question (ignoring case), else the
 * pack's default answer.
 */
export function matchFixture(fixtures: Fixtures, question: string): Fixture {
  const wanted = question.toLowerCase();
  return (
    fixtures.fixtures.find((fixture) =>
      (fixture.keywords ?? []).some((keyword) =>
        wanted.includes(keyword.toLowerCase()),
      ),
    ) ?? fixtures.default
  );
}

/**
 * One word and the whitespace after it per token, as the pack's reference route streams.
 * Unlike the reference, leading whitespace rides on the first token, so the tokens always
 * join back into the text exactly (CONTRACT.md).
 */
export function tokenize(text: string): string[] {
  return text.match(/\s*\S+\s*/g) ?? (text === "" ? [] : [text]);
}

export const FALLBACK_ERROR = "Something went wrong.";

/** Every event a fixture streams: an error fixture fails at once, anything else streams then ends. */
export function fixtureEvents(fixture: Fixture): StreamEvent[] {
  if (fixture.kind === "error") {
    return [{ type: "error", message: fixture.error ?? FALLBACK_ERROR }];
  }
  return [
    ...tokenize(fixture.answer.text).map((value): StreamEvent => ({
      type: "token",
      value,
    })),
    {
      type: "done",
      kind: fixture.kind,
      citations: fixture.answer.citations,
      confidence: fixture.answer.confidence,
    },
  ];
}
