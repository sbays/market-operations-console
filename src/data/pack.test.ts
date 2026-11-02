import { describe, expect, it } from "vitest";
import rawDataset from "@/pack/data.json";
import { resolveCitation } from "@/domain/citations";
import { matchFixture } from "@/domain/fixtures";
import type { EntityRef, Status } from "@/domain/schema";
import {
  displayedRatio,
  selectionPeriod,
  statusAt,
  valueAt,
} from "@/domain/selectors";
import { StarterPackSchema } from "@/domain/starterPack";
import { loadDataset, loadFixtures } from "./pack";
import { SUGGESTED_QUESTIONS } from "./suggestions";

const dataset = loadDataset();
const pack = StarterPackSchema.parse(rawDataset);
const latest = pack.meta.latestPeriod;

const market = (id: string): EntityRef => ({ level: "market", id });

const PACK_STATUS: Record<
  (typeof pack.markets)[number]["kpis"]["status"],
  Status
> = {
  on_track: "on-track",
  at_risk: "at-risk",
  off_track: "off-track",
};

describe("the starter pack, as loaded", () => {
  it("covers 24 months to May 2026, 4 regions, 13 markets and 5 products", () => {
    expect(dataset.periods[0]).toBe("2024-06");
    expect(dataset.periods.at(-1)).toBe("2026-05");
    expect(dataset.periods).toHaveLength(24);
    expect(dataset.regions.map((r) => r.id)).toEqual([
      "na",
      "eu",
      "apac",
      "latam",
    ]);
    expect(dataset.markets.map((m) => m.id)).toEqual(
      pack.markets.map((m) => m.id),
    );
    expect(dataset.markets).toHaveLength(13);
    expect(dataset.products).toHaveLength(5);
  });

  it("opens on the pack's latest month", () => {
    expect(selectionPeriod(dataset, null)).toBe(latest);
  });
});

/**
 * The pack precomputes KPIs at its latest month; the app recomputes them from the fact table.
 * These hold the selectors to the pack, so the dashboard never contradicts it.
 */
describe("selectors reproduce the pack's KPIs at its latest month", () => {
  it.each(pack.markets.map((m) => [m.id, m.kpis] as const))(
    "%s",
    (id, kpis) => {
      const ref = market(id);
      expect(statusAt(dataset, ref, latest)).toBe(PACK_STATUS[kpis.status]);
      expect(
        displayedRatio(valueAt(dataset, ref, latest, "growth") ?? NaN),
      ).toBe(displayedRatio(kpis.growthPct / 100));
      expect(
        displayedRatio(valueAt(dataset, ref, latest, "share") ?? NaN),
      ).toBe(displayedRatio(kpis.sharePct / 100));
      // The pack's revenue is the sum of its own rows to within rounding ($2).
      expect(
        Math.abs(
          (valueAt(dataset, ref, latest, "revenue") ?? NaN) - kpis.revenue,
        ),
      ).toBeLessThanOrEqual(2);
      // Its precomputed attainment drifts from its own rows by up to 1.1 points (India:
      // 103.1% stated, 104.2% from the rows). The rows are the facts, so the app shows those.
      expect(
        Math.abs(
          (valueAt(dataset, ref, latest, "attainment") ?? NaN) -
            kpis.forecastAttainmentPct / 100,
        ),
      ).toBeLessThanOrEqual(0.012);
    },
  );

  it("has no share for any other month", () => {
    expect(valueAt(dataset, market("de"), "2026-04", "share")).toBeUndefined();
  });
});

describe("the pack's story", () => {
  it("Germany is off track, with a sharp revenue dip in March 2026", () => {
    expect(statusAt(dataset, market("de"), latest)).toBe("off-track");
    const february = valueAt(dataset, market("de"), "2026-02", "revenue") ?? 0;
    const march = valueAt(dataset, market("de"), "2026-03", "revenue") ?? 0;
    // The pack's note: "Revenue fell 27% versus the prior month."
    expect(displayedRatio(march / february - 1)).toBeCloseTo(-0.27, 2);
    expect(dataset.anomalies).toContainEqual({
      ref: market("de"),
      period: "2026-03",
      metric: "revenue",
      note: "Revenue fell 27% versus the prior month.",
    });
  });

  it("Italy and Brazil are at risk", () => {
    for (const id of ["it", "br"]) {
      expect(statusAt(dataset, market(id), latest), id).toBe("at-risk");
    }
  });

  it("China, Japan and the United States are on or ahead of plan", () => {
    for (const id of ["cn", "jp", "us"]) {
      expect(statusAt(dataset, market(id), latest), id).toBe("on-track");
    }
  });
});

describe("fixtures", () => {
  const fixtures = loadFixtures();
  const all = [fixtures.default, ...fixtures.fixtures];

  it("include the awkward cases: low confidence, abstention, error and a long answer", () => {
    const kinds = all.map((f) => f.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["normal", "low_confidence", "abstain", "error"]),
    );
    expect(all.some((f) => f.answer.text.length > 900)).toBe(true);
  });

  it("cite only entities and months the data contains", () => {
    for (const fixture of all) {
      for (const citation of fixture.answer.citations) {
        expect(
          resolveCitation(dataset, citation),
          `${fixture.id}: ${citation.label ?? ""}`,
        ).toBeDefined();
      }
    }
  });
});

describe("suggested questions", () => {
  it("each reach the fixture they are there to show", () => {
    for (const { fixtureId, question } of SUGGESTED_QUESTIONS) {
      expect(matchFixture(loadFixtures(), question).id, question).toBe(
        fixtureId,
      );
    }
  });

  it("cover every fixture", () => {
    expect(SUGGESTED_QUESTIONS.map((s) => s.fixtureId).sort()).toEqual(
      loadFixtures()
        .fixtures.map((f) => f.id)
        .sort(),
    );
  });
});
