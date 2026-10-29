/**
 * How the mock assistant answers: exact (normalised) fixture matching, and turning a fixture
 * into the stream events of src/pack/CONTRACT.md. Pure; the route adds pacing.
 */
import type { Fixture, Month, StreamEvent } from "./schema";

/** How questions are compared for a match: case- and spacing-insensitive. */
export function normaliseQuestion(question: string): string {
  return question.trim().replace(/\s+/g, " ").toLowerCase();
}

export function matchFixture(
  fixtures: Fixture[],
  question: string,
): Fixture | undefined {
  const wanted = normaliseQuestion(question);
  return fixtures.find((f) => normaliseQuestion(f.question) === wanted);
}

export const UNMATCHED_REASON =
  "This demo assistant only answers its prepared questions, and this isn't one of them, so it won't guess. Try one of the suggested questions.";

/** Token lengths cycle through these, so citation markers sometimes split across tokens. */
const TOKEN_LENGTHS = [5, 3, 7, 4, 9, 6, 8];

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let position = 0;
  for (let i = 0; position < text.length; i++) {
    const length = TOKEN_LENGTHS[i % TOKEN_LENGTHS.length] ?? 5;
    tokens.push(text.slice(position, position + length));
    position += length;
  }
  return tokens;
}

const tokens = (text: string | undefined): StreamEvent[] =>
  text ? tokenize(text).map((t) => ({ type: "token", text: t })) : [];

/** Every event a fixture streams: tokens, then exactly one terminal event. */
export function fixtureEvents(
  fixture: Fixture | undefined,
  coverage: { from: Month; to: Month },
): StreamEvent[] {
  if (!fixture) {
    return [{ type: "abstain", reason: UNMATCHED_REASON, coverage }];
  }
  const response = fixture.response;
  switch (response.kind) {
    case "answer":
      return [
        ...tokens(response.text),
        {
          type: "final",
          confidence: response.confidence,
          citations: response.citations,
          ...(response.uncertainty
            ? { uncertainty: response.uncertainty }
            : {}),
        },
      ];
    case "abstention":
      return [
        ...tokens(response.text),
        { type: "abstain", reason: response.reason, coverage },
      ];
    case "error":
      return [
        ...tokens(response.text),
        { type: "error", message: response.message, retryable: true },
      ];
  }
}
