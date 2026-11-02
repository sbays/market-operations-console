/**
 * The suggested-question chips: one question per starter-pack fixture, so every answer the
 * mock can give (including the hedged, refused and failed ones) is one click away. The pack
 * has no suggestions of its own; pack.test.ts checks each question reaches its fixture.
 */
export const SUGGESTED_QUESTIONS: { fixtureId: string; question: string }[] = [
  { fixtureId: "at-risk", question: "Which markets are at risk this quarter?" },
  {
    fixtureId: "germany-dip",
    question: "Why did Germany's revenue dip in March?",
  },
  {
    fixtureId: "apac-vs-europe",
    question: "Compare APAC and Europe on growth",
  },
  {
    fixtureId: "forecast-miss",
    question: "What's driving the portfolio's forecast miss?",
  },
  { fixtureId: "next-year", question: "Will sales grow next year?" },
  {
    fixtureId: "summary-long",
    question: "Give me a full overview of the portfolio",
  },
  { fixtureId: "error", question: "Force error (demo a failed answer)" },
];
