import { describe, expect, it } from "vitest";
import { loadDataset } from "@/data/pack";
import { factsReport, SHOWN_RISKS } from "./facts";

const dataset = loadDataset();

function report(...args: string[]): string {
  const result = factsReport(dataset, args);
  if (!result.ok) throw new Error(result.error);
  return result.text;
}

describe("factsReport", () => {
  it("defaults to the dashboard's period and the portfolio", () => {
    const text = report();

    expect(text).toMatch(/^Portfolio, May 2026 \(2026-05\)/);
    expect(text).toMatch(/Europe\s+95\.4%\s+\+1\.7%\s+14\.9%\s+At risk/);
    expect(text).toContain("* Europe: At risk.");
  });

  it("drills by the URL's path, so a region's markets show their own status", () => {
    const text = report("2026-05", "latam");

    expect(text).toMatch(/^LATAM, May 2026/);
    expect(text).toMatch(/LATAM\s+98\.0%.*On track/);
    expect(text).toMatch(/Brazil\s+95\.5%.*At risk/);
  });

  it("marks only the risks the dashboard shows and lists the rest", () => {
    const lines = report("2026-Q1", "eu.de").split("\n");
    const risks = lines.slice(
      lines.indexOf(lines.find((l) => l.startsWith("Top risks")) ?? "") + 1,
    );

    expect(risks.filter((l) => l.startsWith("*"))).toHaveLength(SHOWN_RISKS);
    expect(risks.length).toBeGreaterThan(SHOWN_RISKS);
  });

  it("says when a period has no share", () => {
    expect(report("2026-Q1")).toMatch(/Portfolio\s+\S+\s+\S+\s+No data/);
  });

  it("rejects a period or path outside the data", () => {
    expect(factsReport(dataset, ["1999-01"])).toEqual({
      ok: false,
      error: "No data for period 1999-01.",
    });
    expect(factsReport(dataset, ["zz"])).toEqual({
      ok: false,
      error: 'No entity at path "zz".',
    });
  });
});
