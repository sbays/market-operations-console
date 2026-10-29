import { describe, expect, it } from "vitest";
import {
  formatCoverage,
  formatCurrency,
  formatMetric,
  formatMetricName,
  formatMetricOrMissing,
  formatNumber,
  formatPercent,
  formatPeriod,
  formatPoints,
  formatStatus,
  formatTypedPercent,
  formatWebVital,
} from "./format";

describe("formatCurrency", () => {
  it("abbreviates large USD amounts to one decimal", () => {
    expect(formatCurrency(4_100_000)).toBe("$4.1M");
    expect(formatCurrency(48_240_000)).toBe("$48.2M");
    expect(formatCurrency(1_260_000_000)).toBe("$1.3B");
  });

  it("keeps small amounts whole", () => {
    expect(formatCurrency(950)).toBe("$950");
  });
});

describe("formatPercent", () => {
  it("shows ratios as percentages with one decimal", () => {
    expect(formatPercent(0.931)).toBe("93.1%");
    expect(formatPercent(0.18)).toBe("18.0%");
  });

  it("adds a sign for changes when asked, but not to zero", () => {
    expect(formatPercent(0.042, { signed: true })).toBe("+4.2%");
    expect(formatPercent(-0.18, { signed: true })).toBe("-18.0%");
    expect(formatPercent(0, { signed: true })).toBe("0.0%");
  });
});

describe("formatPoints", () => {
  it("reads a gap in percentage points with one decimal", () => {
    expect(formatPoints(14.5)).toBe("14.5 points");
    expect(formatPoints(5)).toBe("5.0 points");
  });
});

describe("formatNumber", () => {
  it("abbreviates large counts and keeps small ones whole", () => {
    expect(formatNumber(12_345)).toBe("12.3K");
    expect(formatNumber(2_400_000)).toBe("2.4M");
    expect(formatNumber(950)).toBe("950");
  });
});

describe("formatPeriod", () => {
  it("formats months as short month and year", () => {
    expect(formatPeriod("2026-03")).toBe("Mar 2026");
    expect(formatPeriod("2024-10")).toBe("Oct 2024");
  });

  it("formats quarters as quarter and year", () => {
    expect(formatPeriod("2026-Q3")).toBe("Q3 2026");
  });
});

describe("formatMetric", () => {
  it("formats each metric the way the dashboard shows it", () => {
    expect(formatMetric("revenue", 4_100_000)).toBe("$4.1M");
    expect(formatMetric("forecast", 5_000_000)).toBe("$5M");
    expect(formatMetric("units", 12_345)).toBe("12.3K");
    expect(formatMetric("attainment", 0.931)).toBe("93.1%");
    expect(formatMetric("share", 0.184)).toBe("18.4%");
    expect(formatMetric("growth", 0.12)).toBe("+12.0%");
    expect(formatMetric("growth", -0.035)).toBe("-3.5%");
  });
});

describe("formatPeriod: review fixes", () => {
  it("refuses impossible months instead of rolling them over", () => {
    // Values that skipped the schema: the types already reject them at compile time.
    // @ts-expect-error month 13 is not a Month
    expect(() => formatPeriod("2026-13")).toThrow(RangeError);
    // @ts-expect-error month 00 is not a Month
    expect(() => formatPeriod("2026-00")).toThrow(RangeError);
  });
});

describe("formatPeriod: types", () => {
  it("won't compile a string that isn't a period", () => {
    // @ts-expect-error "banana" is not a PeriodRef
    expect(() => formatPeriod("banana")).toThrow(RangeError);
  });
});

describe("formatMetricName", () => {
  it("names every metric for labels and chips", () => {
    expect(formatMetricName("revenue")).toBe("Revenue");
    expect(formatMetricName("units")).toBe("Units");
    expect(formatMetricName("forecast")).toBe("Forecast");
    expect(formatMetricName("growth")).toBe("Growth vs prior year");
    expect(formatMetricName("attainment")).toBe("Forecast attainment");
    expect(formatMetricName("share")).toBe("Market share");
  });
});

describe("formatCoverage", () => {
  it("reads as a range of months", () => {
    expect(formatCoverage({ from: "2024-10", to: "2026-09" })).toBe(
      "Oct 2024 to Sep 2026",
    );
  });
});

describe("formatStatus", () => {
  it("names each status in words, never by colour alone", () => {
    expect(formatStatus("on-track")).toBe("On track");
    expect(formatStatus("at-risk")).toBe("At risk");
    expect(formatStatus("off-track")).toBe("Off track");
  });
});

describe("formatMetricOrMissing", () => {
  it("formats a value, and says so plainly when there is none", () => {
    expect(formatMetricOrMissing("revenue", 4_100_000)).toBe("$4.1M");
    expect(formatMetricOrMissing("attainment", undefined)).toBe("No data");
  });
});

describe("formatTypedPercent", () => {
  it("shows a percentage the user typed as a whole number", () => {
    expect(formatTypedPercent(95)).toBe("95%");
    expect(formatTypedPercent(-100)).toBe("-100%");
    expect(formatTypedPercent(1000)).toBe("1,000%");
  });
});

describe("formatWebVital", () => {
  it("shows timings in whole milliseconds with their rating", () => {
    expect(
      formatWebVital({ name: "LCP", value: 1234.56, rating: "good" }),
    ).toBe("LCP 1,235ms (good)");
    expect(
      formatWebVital({ name: "INP", value: 312, rating: "needs-improvement" }),
    ).toBe("INP 312ms (needs improvement)");
  });

  it("shows layout shift as a unitless score", () => {
    expect(formatWebVital({ name: "CLS", value: 0.0812, rating: "good" })).toBe(
      "CLS 0.081 (good)",
    );
  });
});
