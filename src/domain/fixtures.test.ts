import { describe, expect, it } from "vitest";
import type { Fixture, Fixtures } from "./schema";
import {
  FALLBACK_ERROR,
  fixtureEvents,
  matchFixture,
  tokenize,
} from "./fixtures";

const atRisk: Fixture = {
  id: "at-risk",
  keywords: ["at risk", "which markets"],
  kind: "normal",
  answer: {
    text: "Three markets stand out.",
    citations: [{ marketId: "de", period: "2026-05", label: "Germany" }],
    confidence: "high",
  },
};

const germany: Fixture = {
  id: "germany-dip",
  keywords: ["germany"],
  kind: "normal",
  answer: { text: "Germany fell.", citations: [], confidence: "high" },
};

const fallback: Fixture = {
  id: "default",
  kind: "low_confidence",
  answer: { text: "I don't have enough.", citations: [], confidence: "low" },
};

const fixtures: Fixtures = { default: fallback, fixtures: [atRisk, germany] };

describe("matchFixture", () => {
  it("matches a keyword anywhere in the question, ignoring case", () => {
    expect(matchFixture(fixtures, "Why did GERMANY dip?")).toBe(germany);
  });

  it("takes the first fixture to match, in order", () => {
    expect(matchFixture(fixtures, "Is Germany at risk?")).toBe(atRisk);
  });

  it("falls back to the default answer", () => {
    expect(matchFixture(fixtures, "How is Peru doing?")).toBe(fallback);
  });

  it("skips a fixture without keywords", () => {
    const noKeywords = { ...germany, keywords: undefined };
    expect(
      matchFixture({ default: fallback, fixtures: [noKeywords] }, "germany"),
    ).toBe(fallback);
  });
});

describe("tokenize", () => {
  it("streams a word and its trailing whitespace per token", () => {
    expect(tokenize("Here's the portfolio.\n\nOverall ")).toEqual([
      "Here's ",
      "the ",
      "portfolio.\n\n",
      "Overall ",
    ]);
  });

  it("joins back into the text exactly, leading whitespace included", () => {
    for (const text of [
      "A  long\nanswer, with  spacing. ",
      "\n  Starts with a blank line.",
      "   ",
    ]) {
      expect(tokenize(text).join(""), JSON.stringify(text)).toBe(text);
    }
    expect(tokenize("")).toEqual([]);
  });
});

describe("fixtureEvents", () => {
  it("streams the answer's words, then ends with its kind, citations and confidence", () => {
    expect(fixtureEvents(atRisk)).toEqual([
      { type: "token", value: "Three " },
      { type: "token", value: "markets " },
      { type: "token", value: "stand " },
      { type: "token", value: "out." },
      {
        type: "done",
        kind: "normal",
        citations: atRisk.answer.citations,
        confidence: "high",
      },
    ]);
  });

  it("ends a hedged or refused answer with its own kind", () => {
    expect(fixtureEvents(fallback).at(-1)).toMatchObject({
      type: "done",
      kind: "low_confidence",
      confidence: "low",
    });
    expect(
      fixtureEvents({ ...fallback, kind: "abstain" }).at(-1),
    ).toMatchObject({ type: "done", kind: "abstain" });
  });

  it("fails an error fixture at once, with its message", () => {
    const error: Fixture = {
      id: "error",
      keywords: ["force error"],
      kind: "error",
      answer: { text: "", citations: [], confidence: "low" },
      error: "The model service timed out.",
    };
    expect(fixtureEvents(error)).toEqual([
      { type: "error", message: "The model service timed out." },
    ]);
    expect(fixtureEvents({ ...error, error: undefined })).toEqual([
      { type: "error", message: FALLBACK_ERROR },
    ]);
  });
});
