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
      { level: "market", id: "de" },
      { level: "product", marketId: "de", id: "nuvora" },
    ]) {
      expect(EntityRefSchema.safeParse(ref).success).toBe(true);
    }
  });

  it("rejects a product without its market", () => {
    expect(
      EntityRefSchema.safeParse({ level: "product", id: "nuvora" }).success,
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
});

const germany = {
  id: "de",
  iso2: "DE",
  name: "Germany",
  regionId: "eu",
  series: { veltrix: [point("2026-01"), point("2026-02")] },
  marketSize: { "2026-02": 1000 },
};

const validDataset = {
  currency: "USD",
  periods: ["2026-01", "2026-02"],
  regions: [{ id: "eu", name: "Europe" }],
  products: [{ id: "veltrix", name: "Veltrix" }],
  markets: [germany],
  anomalies: [
    {
      ref: { level: "market", id: "de" },
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
    ).toContain('Market de is in unknown region "apac"');
  });

  it("rejects a market missing a product's series", () => {
    expect(
      issuesOf({ ...validDataset, markets: [{ ...germany, series: {} }] }),
    ).toContain("Market de has no series for product veltrix");
  });

  it("rejects a series that does not cover every period in order", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [
          {
            ...germany,
            series: { veltrix: [point("2026-02"), point("2026-01")] },
          },
        ],
      }),
    ).toContain("Series de/veltrix does not match the dataset periods");
  });

  it("rejects an anomaly that points at an unknown market or period", () => {
    const anomaly = validDataset.anomalies[0];
    expect(
      issuesOf({
        ...validDataset,
        anomalies: [{ ...anomaly, ref: { level: "market", id: "fr" } }],
      }),
    ).toContain("Anomaly refers to unknown entity market fr");
    expect(
      issuesOf({
        ...validDataset,
        anomalies: [{ ...anomaly, period: "2025-12" }],
      }),
    ).toContain("Anomaly refers to unknown period 2025-12");
  });

  it("rejects a market size for a month outside the data", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [{ ...germany, marketSize: { "2026-03": 1000 } }],
      }),
    ).toContain("Market de has a market size for unknown month 2026-03");
  });

  it("rejects negative values", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [
          {
            ...germany,
            series: {
              veltrix: [{ ...point("2026-01"), actual: -1 }, point("2026-02")],
            },
          },
        ],
      }),
    ).not.toEqual([]);
  });
});

const citation = {
  marketId: "de",
  period: "2026-03",
  label: "Germany, Mar 2026",
};

describe("StreamEventSchema", () => {
  it("accepts each event in the pack's contract", () => {
    for (const event of [
      { type: "token", value: "Three " },
      {
        type: "done",
        kind: "normal",
        citations: [citation, { regionId: "eu" }, {}],
        confidence: "high",
      },
      {
        type: "done",
        kind: "low_confidence",
        citations: [],
        confidence: "low",
      },
      { type: "done", kind: "abstain", citations: [], confidence: "low" },
      { type: "error", message: "Upstream timeout" },
    ]) {
      expect(StreamEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it("rejects events that break the contract", () => {
    for (const event of [
      { type: "token", value: 42 },
      { type: "token", text: "Three " },
      { type: "done", kind: "normal", citations: [], confidence: 0.8 },
      { type: "done", kind: "partial", citations: [], confidence: "high" },
      {
        type: "done",
        kind: "normal",
        citations: [{ ...citation, period: "2026-Q1" }],
        confidence: "high",
      },
      { type: "error", message: "" },
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
    keywords: ["germany"],
    kind: "normal",
    answer: {
      text: "Germany's revenue fell in early 2026.",
      citations: [citation],
      confidence: "high",
    },
  };
  const fallback = {
    id: "default",
    kind: "low_confidence",
    answer: { text: "I don't have enough.", citations: [], confidence: "low" },
  };

  it("accepts the pack's fixture kinds", () => {
    expect(
      FixturesSchema.safeParse({
        note: "Canned answers",
        default: fallback,
        fixtures: [
          answer,
          {
            id: "next-year",
            keywords: ["next year"],
            kind: "abstain",
            answer: {
              text: "I can't answer that.",
              citations: [],
              confidence: "low",
            },
          },
          {
            id: "error",
            keywords: ["force error"],
            kind: "error",
            answer: { text: "", citations: [], confidence: "low" },
            error: "Simulated upstream failure.",
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate ids, the default's included", () => {
    expect(
      FixturesSchema.safeParse({
        default: fallback,
        fixtures: [answer, { ...answer, keywords: ["german"] }],
      }).success,
    ).toBe(false);
    expect(
      FixturesSchema.safeParse({
        default: fallback,
        fixtures: [{ ...answer, id: "default" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an answer with no text, unless it is an error", () => {
    expect(
      FixturesSchema.safeParse({
        default: fallback,
        fixtures: [{ ...answer, answer: { ...answer.answer, text: "" } }],
      }).success,
    ).toBe(false);
  });
});

describe("DatasetSchema: review fixes", () => {
  it("rejects a series for a product that is not in the dataset", () => {
    expect(
      issuesOf({
        ...validDataset,
        markets: [
          {
            ...germany,
            series: { ...germany.series, zeta: germany.series.veltrix },
          },
        ],
      }),
    ).toContain("Market de has a series for unknown product zeta");
  });

  it("rejects periods that are not consecutive months", () => {
    expect(
      issuesOf({ ...validDataset, periods: ["2026-02", "2026-01"] }),
    ).toContain("Periods must be consecutive months in order");
    expect(
      issuesOf({ ...validDataset, periods: ["2026-01", "2026-01"] }),
    ).toContain("Periods must be consecutive months in order");
  });
});

describe("DatasetSchema: unique ids", () => {
  it("rejects duplicate region, market and product ids", () => {
    expect(
      issuesOf({ ...validDataset, markets: [germany, germany] }),
    ).toContain("Duplicate market id de");
    expect(
      issuesOf({
        ...validDataset,
        regions: [...validDataset.regions, { id: "eu", name: "Europe again" }],
      }),
    ).toContain("Duplicate region id eu");
    expect(
      issuesOf({
        ...validDataset,
        products: [
          ...validDataset.products,
          { id: "veltrix", name: "Veltrix 2" },
        ],
      }),
    ).toContain("Duplicate product id veltrix");
  });
});
