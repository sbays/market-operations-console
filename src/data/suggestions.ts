/**
 * The suggested-question chips: one question per starter-pack fixture, so every answer the
 * mock can give is one click away. The first four are the brief's example questions, word
 * for word; the "[period]" in its Germany question is March 2026, the pack's dip. The pack
 * has no suggestions of its own; pack.test.ts checks each question reaches its fixture.
 */
export const SUGGESTED_QUESTIONS: { fixtureId: string; question: string }[] = [
  {
    fixtureId: "at-risk",
    question: "Which markets are at risk this quarter, and why?",
  },
  {
    fixtureId: "germany-dip",
    question: "Why did Germany's revenue dip in March 2026?",
  },
  {
    fixtureId: "apac-vs-europe",
    question: "Compare APAC and Europe on growth and forecast attainment",
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
