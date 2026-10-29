import { describe, expect, it } from "vitest";
import type { Fixture } from "./schema";
import {
  fixtureEvents,
  matchFixture,
  tokenize,
  UNMATCHED_REASON,
} from "./fixtures";

const coverage = { from: "2024-10", to: "2026-09" } as const;

const citation = {
  id: 1,
  ref: { level: "market", id: "DE" },
  period: "2026-03",
  metric: "revenue",
} as const;

const answer: Fixture = {
  id: "germany-dip",
  question: "Why did Germany dip?",
  suggested: true,
  response: {
    kind: "answer",
    text: "Revenue was $4M [1] in March",
    confidence: 0.9,
    citations: [citation],
  },
};

describe("matchFixture", () => {
  it("matches ignoring case and spacing", () => {
    expect(matchFixture([answer], "  why did   GERMANY dip? ")).toBe(answer);
  });

  it("returns undefined for any other question", () => {
    expect(matchFixture([answer], "Why did Germany dip")).toBeUndefined();
  });
});

describe("tokenize", () => {
  it("cuts text into 3–9 character pieces that sometimes split a marker", () => {
    // Lengths cycle 5, 3, 7, 4, 9, …: cuts at 5, 8, 15, 19, 28 split "[12]" after "[12".
    expect(tokenize("Revenue was $4M [12] in March")).toEqual([
      "Reven",
      "ue ",
      "was $4M",
      " [12",
      "] in Marc",
      "h",
    ]);
  });
});

describe("fixtureEvents", () => {
  it("streams an answer's text, then a final event with its evidence", () => {
    const events = fixtureEvents(answer, coverage);
    const final = events.at(-1);
    expect(
      events
        .slice(0, -1)
        .map((e) => (e.type === "token" ? e.text : "?"))
        .join(""),
    ).toBe("Revenue was $4M [1] in March");
    expect(final).toEqual({
      type: "final",
      confidence: 0.9,
      citations: [citation],
    });
  });

  it("passes on an answer's uncertainty", () => {
    const uncertain: Fixture = {
      ...answer,
      response: {
        ...answer.response,
        kind: "answer",
        text: "Maybe",
        confidence: 0.4,
        citations: [],
        uncertainty: "Thin data",
      },
    };
    expect(fixtureEvents(uncertain, coverage).at(-1)).toEqual({
      type: "final",
      confidence: 0.4,
      citations: [],
      uncertainty: "Thin data",
    });
  });

  it("ends an abstention with the data's coverage", () => {
    const abstention: Fixture = {
      id: "q1-2027",
      question: "Q1 2027?",
      suggested: true,
      response: { kind: "abstention", reason: "Beyond the data" },
    };
    expect(fixtureEvents(abstention, coverage)).toEqual([
      { type: "abstain", reason: "Beyond the data", coverage },
    ]);
  });

  it("streams the partial answer before a retryable error", () => {
    const failing: Fixture = {
      id: "broken",
      question: "Broken?",
      suggested: false,
      response: { kind: "error", text: "Germany's", message: "Timed out" },
    };
    expect(fixtureEvents(failing, coverage)).toEqual([
      { type: "token", text: "Germa" },
      { type: "token", text: "ny'" },
      { type: "token", text: "s" },
      { type: "error", message: "Timed out", retryable: true },
    ]);
  });

  it("abstains, without guessing, when no fixture matches", () => {
    expect(fixtureEvents(undefined, coverage)).toEqual([
      { type: "abstain", reason: UNMATCHED_REASON, coverage },
    ]);
  });
});
