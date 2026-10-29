import { describe, expect, it } from "vitest";
import type { TrendPoint } from "./selectors";
import { trendSummary } from "./summaries";

const trend: TrendPoint[] = [
  { period: "2026-01", actual: 100, forecast: 200, priorYear: 90 },
  { period: "2026-06", actual: 150, forecast: 200, priorYear: 130 },
];

describe("trendSummary", () => {
  it("states the span, the latest month and its attainment against forecast", () => {
    expect(trendSummary(trend, "Germany")).toBe(
      "Germany revenue, Jan 2026 to Jun 2026: $150 in Jun 2026, 75.0% of forecast.",
    );
  });

  it("says there is no data when the points are empty", () => {
    expect(trendSummary([], "Germany")).toBe(
      "Germany: no data for this selection.",
    );
  });

  it("leaves out the forecast clause when there is no forecast to compare", () => {
    const noForecast: TrendPoint[] = [
      { period: "2026-01", actual: 100, forecast: 0, priorYear: 90 },
      { period: "2026-06", actual: 150, forecast: 0, priorYear: 130 },
    ];
    expect(trendSummary(noForecast, "Germany")).toBe(
      "Germany revenue, Jan 2026 to Jun 2026: $150 in Jun 2026.",
    );
  });
});
