import { describe, expect, it } from "vitest";
import {
  ChatRequestSchema,
  DatasetSchema,
  EntityRefSchema,
  FixturesSchema,
  MonthSchema,
  PeriodRefSchema,
  StreamEventSchema,
} from "./schema";

describe("EntityRefSchema", () => {
  it("accepts every level of the hierarchy", () => {
    for (const ref of [
      { level: "portfolio" },
      { level: "region", id: "eu" },
      { level: "market", id: "DE" },
      { level: "product", marketId: "DE", id: "beacon" },
    ]) {
      expect(EntityRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it("rejects a product without its market", () => {
    expect(
      EntityRefSchema.safeParse({ level: "product", id: "beacon" }).success,
    ).toBe(false);
  });

  it("rejects market ids that are not ISO alpha-2", () => {
    expect(
      EntityRefSchema.safeParse({ level: "market", id: "DEU" }).success,
    ).toBe(false);
  });
});

describe("periods", () => {
  it("accepts months and quarters", () => {
    expect(PeriodRefSchema.safeParse("2026-03").success).toBe(true);
    expect(PeriodRefSchema.safeParse("2026-Q3").success).toBe(true);
  });

  it("rejects impossible months and quarters", () => {
    expect(MonthSchema.safeParse("2026-13").success).toBe(false);
    expect(MonthSchema.safeParse("2026-00").success).toBe(false);
    expect(PeriodRefSchema.safeParse("2026-Q5").success).toBe(false);
    expect(MonthSchema.safeParse("2026-Q3").success).toBe(false);
  });
});

const point = (period: string) => ({
  period,
  actual: 100,
  units: 10,
  forecast: 110,
  priorYear: 90,
  marketSize: 1000,
});

const germany = {
  id: "DE",
  name: "Germany",
  regionId: "eu",
  series: { atlas: [point("2026-01"), point("2026-02")] },
};

const validDataset = {
  currency: "USD",
  periods: ["2026-01", "2026-02"],
  regions: [{ id: "eu", name: "Europe" }],
  products: [{ id: "atlas", name: "Atlas" }],
  markets: [germany],
  anomalies: [
    {
      ref: { level: "market", id: "DE" },
      period: "2026-02",
      metric: "revenue",
      note: "Distributor stock-out",
    },
  ],
};

function issuesOf(input: unknown): string[] {
  const result = DatasetSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("DatasetSchema", () => {
  it("accepts a consistent dataset", () => {
    expect(issuesOf(validDataset)).toEqual([]);
  });

  it("rejects a market in a region that does not exist", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [{ ...germany, regionId: "apac" }],
      }),
    ).toContain('Market DE is in unknown region "apac"');
  });

  it("rejects a market missing a product's series", () => {
    expect(
      issuesOf({ ...validDataset, markets: [{ ...germany, series: {} }] }),
    ).toContain("Market DE has no series for product atlas");
  });

  it("rejects a series that does not cover every period in order", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [
          {
            ...germany,
            series: { atlas: [point("2026-02"), point("2026-01")] },
          },
        ],
      }),
    ).toContain("Series DE/atlas does not match the dataset periods");
  });

  it("rejects an anomaly that points at an unknown market or period", () => {
    const anomaly = validDataset.anomalies[0];
    expect(
      issuesOf({
        ...validDataset,
        anomalies: [{ ...anomaly, ref: { level: "market", id: "FR" } }],
      }),
    ).toContain("Anomaly refers to unknown entity market FR");
    expect(
      issuesOf({
        ...validDataset,
        anomalies: [{ ...anomaly, period: "2025-12" }],
      }),
    ).toContain("Anomaly refers to unknown period 2025-12");
  });

  it("rejects negative values", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [
          {
            ...germany,
            series: {
              atlas: [{ ...point("2026-01"), actual: -1 }, point("2026-02")],
            },
          },
        ],
      }),
    ).not.toEqual([]);
  });
});

const citation = {
  id: 1,
  ref: { level: "market", id: "DE" },
  period: "2026-03",
  metric: "revenue",
};

describe("StreamEventSchema", () => {
  it("accepts each event in the contract", () => {
    for (const event of [
      { type: "token", text: "Germany fell [1" },
      { type: "final", confidence: 0.82, citations: [citation] },
      {
        type: "final",
        confidence: 0.4,
        citations: [],
        uncertainty: "Only three months of launch data",
      },
      {
        type: "abstain",
        reason: "Forecasts beyond the data are not available",
        coverage: { from: "2024-10", to: "2026-09" },
      },
      { type: "error", message: "Upstream timeout", retryable: true },
    ]) {
      expect(StreamEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("rejects events that break the contract", () => {
    for (const event of [
      { type: "token", text: 42 },
      { type: "final", confidence: 1.2, citations: [] },
      {
        type: "final",
        confidence: 0.8,
        citations: [{ ...citation, metric: "profit" }],
      },
      {
        type: "final",
        confidence: 0.8,
        citations: [citation, { ...citation }],
      },
      { type: "ping" },
    ]) {
      expect(StreamEventSchema.safeParse(event).success).toBe(false);
    }
  });
});

describe("ChatRequestSchema", () => {
  it("trims the question", () => {
    expect(ChatRequestSchema.parse({ question: "  Why?  " })).toEqual({
      question: "Why?",
    });
  });

  it("rejects empty and overlong questions", () => {
    expect(ChatRequestSchema.safeParse({ question: "   " }).success).toBe(
      false,
    );
    expect(
      ChatRequestSchema.safeParse({ question: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

describe("FixturesSchema", () => {
  const answer = {
    id: "germany-dip",
    question: "Why did Germany dip?",
    suggested: true,
    response: {
      kind: "answer",
      text: "Revenue fell to $4.1M [1].",
      confidence: 0.82,
      citations: [citation],
    },
  };

  it("accepts answer, abstention and error fixtures", () => {
    expect(
      FixturesSchema.safeParse([
        answer,
        {
          id: "next-year",
          question: "What will revenue be in Q1 2027?",
          suggested: true,
          response: {
            kind: "abstention",
            reason: "The data ends in September 2026.",
          },
        },
        {
          id: "broken",
          question: "Break down Germany by sales rep",
          suggested: false,
          response: {
            kind: "error",
            text: "Looking at Germany",
            message: "Upstream timeout",
          },
        },
      ]).success,
    ).toBe(true);
  });

  it("rejects duplicate questions, ignoring case and spacing", () => {
    expect(
      FixturesSchema.safeParse([
        answer,
        { ...answer, id: "dup", question: " why did  GERMANY dip? " },
      ]).success,
    ).toBe(false);
  });
});
