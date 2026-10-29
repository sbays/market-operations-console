import { describe, expect, it } from "vitest";
import { DatasetSchema } from "./schema";
import {
  AlertRuleInputSchema,
  AlertRuleSchema,
  describeAlert,
  THRESHOLD_RANGE,
  type AlertRuleInput,
} from "./alert";

/** A tiny dataset: the description only needs names, so each series holds one point. */
const point = {
  period: "2026-01",
  actual: 1,
  units: 1,
  forecast: 1,
  priorYear: 1,
  marketSize: 1,
};
const dataset = DatasetSchema.parse({
  currency: "USD",
  periods: ["2026-01"],
  regions: [{ id: "eu", name: "Europe" }],
  products: [{ id: "beacon", name: "Beacon" }],
  markets: [
    {
      id: "DE",
      name: "Germany",
      regionId: "eu",
      series: { beacon: [point] },
    },
    {
      id: "FR",
      name: "France",
      regionId: "eu",
      series: { beacon: [point] },
    },
  ],
  anomalies: [],
});

const valid: AlertRuleInput = {
  name: "Europe attainment",
  scope: ["eu.DE"],
  metric: "attainment",
  operator: "below",
  threshold: 95,
};

/** Each issue as "path: message", so assertions read as the user would see them. */
function issuesOf(input: unknown): string[] {
  const result = AlertRuleInputSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
}

const withThreshold = (metric: "growth" | "attainment", threshold: number) =>
  AlertRuleInputSchema.safeParse({ ...valid, metric, threshold }).success;

describe("AlertRuleInputSchema", () => {
  it("accepts a complete rule", () => {
    expect(AlertRuleInputSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name and rejects a blank one", () => {
    const parsed = AlertRuleInputSchema.parse({
      ...valid,
      name: "  Watch EU  ",
    });
    expect(parsed.name).toBe("Watch EU");
    expect(issuesOf({ ...valid, name: "   " })).toContain(
      "name: Give the rule a name.",
    );
  });

  it("rejects a name longer than 60 characters", () => {
    expect(issuesOf({ ...valid, name: "x".repeat(61) })).toContain(
      "name: Keep the rule name to 60 characters or fewer.",
    );
    expect(issuesOf({ ...valid, name: "x".repeat(60) })).toEqual([]);
  });

  it("requires at least one scope path", () => {
    expect(issuesOf({ ...valid, scope: [] })).toContain(
      "scope: Pick at least one region or market.",
    );
  });

  it("only accepts the two metrics and the two operators", () => {
    expect(issuesOf({ ...valid, metric: "revenue" })).toHaveLength(1);
    expect(issuesOf({ ...valid, operator: "equals" })).toHaveLength(1);
  });

  it("rejects a threshold that is not a finite number", () => {
    expect(issuesOf({ ...valid, threshold: Number.NaN })).toHaveLength(1);
    expect(
      issuesOf({ ...valid, threshold: Number.POSITIVE_INFINITY }),
    ).toHaveLength(1);
  });
});

describe("threshold range by metric", () => {
  it("is growth -100 to 1000 and attainment 0 to 200, as the brief states", () => {
    expect(THRESHOLD_RANGE).toEqual({
      growth: { min: -100, max: 1000 },
      attainment: { min: 0, max: 200 },
    });
  });

  it("accepts growth at both inclusive bounds", () => {
    expect(withThreshold("growth", -100)).toBe(true);
    expect(withThreshold("growth", 1000)).toBe(true);
  });

  it("rejects growth just outside the bounds", () => {
    expect(withThreshold("growth", -100.5)).toBe(false);
    expect(withThreshold("growth", -101)).toBe(false);
    expect(withThreshold("growth", 1000.5)).toBe(false);
    expect(withThreshold("growth", 1001)).toBe(false);
  });

  it("accepts attainment at both inclusive bounds", () => {
    expect(withThreshold("attainment", 0)).toBe(true);
    expect(withThreshold("attainment", 200)).toBe(true);
  });

  it("rejects attainment just outside the bounds", () => {
    expect(withThreshold("attainment", -0.5)).toBe(false);
    expect(withThreshold("attainment", -1)).toBe(false);
    expect(withThreshold("attainment", 200.5)).toBe(false);
    expect(withThreshold("attainment", 201)).toBe(false);
  });

  it("changes the valid range when the metric changes", () => {
    // 300 is a plausible growth threshold but an impossible attainment one.
    expect(withThreshold("growth", 300)).toBe(true);
    expect(withThreshold("attainment", 300)).toBe(false);
  });

  it("still reports the range when another field is also invalid", () => {
    expect(issuesOf({ ...valid, name: "", scope: [], threshold: 300 })).toEqual(
      expect.arrayContaining([
        "name: Give the rule a name.",
        "scope: Pick at least one region or market.",
        "threshold: Attainment thresholds run from 0% to 200%.",
      ]),
    );
  });

  it("reports the range on the threshold field, naming it in the message", () => {
    expect(issuesOf({ ...valid, metric: "growth", threshold: 1001 })).toEqual([
      "threshold: Growth thresholds run from -100% to 1000%.",
    ]);
    expect(
      issuesOf({ ...valid, metric: "attainment", threshold: 201 }),
    ).toEqual(["threshold: Attainment thresholds run from 0% to 200%."]);
  });
});

describe("AlertRuleSchema", () => {
  const stored = { ...valid, id: "3f2c1a9e-0000-4000-8000-000000000001" };

  it("is the input plus a non-empty id", () => {
    expect(AlertRuleSchema.safeParse(stored).success).toBe(true);
    expect(AlertRuleSchema.safeParse({ ...valid }).success).toBe(false);
    expect(AlertRuleSchema.safeParse({ ...stored, id: "" }).success).toBe(
      false,
    );
  });

  it("applies the same threshold range as the input schema", () => {
    expect(
      AlertRuleSchema.safeParse({ ...stored, threshold: 300 }).success,
    ).toBe(false);
    expect(
      AlertRuleSchema.safeParse({
        ...stored,
        metric: "growth",
        threshold: 300,
      }).success,
    ).toBe(true);
  });
});

describe("describeAlert", () => {
  it("reads the rule as one sentence, with the scope named and the threshold formatted", () => {
    const rule = {
      id: "r1",
      name: "Watch Germany",
      scope: ["eu.DE", "eu.FR"],
      metric: "attainment",
      operator: "below",
      threshold: 95,
    } as const;
    expect(describeAlert(rule, dataset)).toBe(
      "Forecast attainment below 95.0% in Germany, France",
    );
  });

  it("formats growth thresholds as signed percentages", () => {
    const rule = {
      id: "r2",
      name: "Big growth",
      scope: ["eu"],
      metric: "growth",
      operator: "above",
      threshold: 300,
    } as const;
    expect(describeAlert(rule, dataset)).toBe(
      "Growth vs prior year above +300.0% in Europe",
    );
  });

  it("skips a scope path the dataset no longer has", () => {
    const rule = {
      id: "r3",
      name: "Stale",
      scope: ["eu.DE", "na.US"],
      metric: "attainment",
      operator: "below",
      threshold: 90,
    } as const;
    expect(describeAlert(rule, dataset)).toBe(
      "Forecast attainment below 90.0% in Germany",
    );
  });
});
