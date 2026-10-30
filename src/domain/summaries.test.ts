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

  it("names the month an anomaly is flagged in", () => {
    expect(trendSummary(trend, "Germany", ["2026-03"])).toBe(
      "Germany revenue, Jan 2026 to Jun 2026: $150 in Jun 2026, 75.0% of forecast. Anomaly flagged in Mar 2026.",
    );
  });

  it("lists several anomaly months in order, joined in plain English", () => {
    expect(
      trendSummary(trend, "Portfolio", ["2026-02", "2026-03", "2026-04"]),
    ).toBe(
      "Portfolio revenue, Jan 2026 to Jun 2026: $150 in Jun 2026, 75.0% of forecast. Anomalies flagged in Feb 2026, Mar 2026, and Apr 2026.",
    );
  });

  it("lists anomaly months in period order, whatever order they arrive in", () => {
    expect(trendSummary(trend, "Portfolio", ["2026-04", "2026-02"])).toBe(
      "Portfolio revenue, Jan 2026 to Jun 2026: $150 in Jun 2026, 75.0% of forecast. Anomalies flagged in Feb 2026 and Apr 2026.",
    );
  });
});
