import { TestDataset } from "@/test/dataset";
import { tinyDataset } from "@/test/tinyDataset";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { countryOf } from "@/domain/geo";
import { type Dataset, type EntityRef, type PeriodRef } from "@/domain/schema";
import { MarketMap } from "./MarketMap";

/*
 * Expected figures are read off the starter pack (src/pack/data.json) once and written down
 * as literals. May 2026, its latest month: Germany 92.2% and shrinking (off track), Spain off
 * track on decline at 104.7%, the United Kingdom, France, Italy and Brazil at risk: six of
 * thirteen markets flagged.
 */

const PORTFOLIO: EntityRef = { level: "portfolio" };
const MAY: PeriodRef = "2026-05";

function renderMap({
  selected = PORTFOLIO,
  period = MAY,
  searchParams = "",
  dataset = loadDataset(),
}: {
  selected?: EntityRef;
  period?: PeriodRef;
  searchParams?: string;
  dataset?: Dataset;
} = {}) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const Nuqs = withNuqsTestingAdapter({
    searchParams,
    onUrlUpdate,
    hasMemory: true,
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Nuqs>
        <TestDataset>{children}</TestDataset>
      </Nuqs>
    );
  }
  render(<MarketMap dataset={dataset} selected={selected} period={period} />, {
    wrapper: Wrapper,
  });
  return { user: userEvent.setup(), onUrlUpdate };
}

function lastUrl(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) {
  const event = onUrlUpdate.mock.calls.at(-1)?.[0];
  return { query: event?.queryString, history: event?.options.history };
}

const SUMMARY =
  "6 of 13 markets are off track or at risk in May 2026; the lowest is Germany at 92.2%.";

const marker = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name}:`) });

describe("MarketMap", () => {
  it("draws every market in the dataset as a country on the map", () => {
    for (const market of loadDataset().markets) {
      expect(countryOf(market.id), market.id).toBeDefined();
    }
  });

  it("names the map by its summary sentence", () => {
    renderMap();

    expect(screen.getByRole("img", { name: SUMMARY })).toBeInTheDocument();
  });

  it("summarises only the selected region's markets", () => {
    renderMap({ selected: { level: "region", id: "eu" } });

    expect(
      screen.getByRole("img", {
        name: "5 of 5 markets in Europe are off track or at risk in May 2026; the lowest is Germany at 92.2%.",
      }),
    ).toBeInTheDocument();
  });

  it("summarises the selected market on its own", () => {
    renderMap({
      selected: { level: "product", marketId: "de", id: "veltrix" },
    });

    expect(
      screen.getByRole("img", {
        name: "Germany: attainment 92.2%, off track, in May 2026.",
      }),
    ).toBeInTheDocument();
  });

  it("gives every market a labelled marker with its attainment and status", () => {
    renderMap();

    expect(screen.getAllByRole("button", { name: /attainment/ })).toHaveLength(
      13,
    );
    expect(marker("Germany")).toHaveAccessibleName(
      "Germany: attainment 92.2%, off track",
    );
    // Off track on decline, though ahead of forecast.
    expect(marker("Spain")).toHaveAccessibleName(
      "Spain: attainment 104.7%, off track",
    );
    expect(marker("Brazil")).toHaveAccessibleName(
      "Brazil: attainment 95.5%, at risk",
    );
    expect(marker("United States")).toHaveAccessibleName(
      "United States: attainment 100.6%, on track",
    );
  });

  it("moves focus between markers with the arrow keys and Home/End", async () => {
    const { user } = renderMap();

    marker("United States").focus();
    await user.keyboard("{ArrowRight}");
    expect(marker("Canada")).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(marker("United States")).toHaveFocus();

    await user.keyboard("{End}");
    expect(marker("Mexico")).toHaveFocus();

    await user.keyboard("{Home}");
    expect(marker("United States")).toHaveFocus();
  });

  it("drills to a market on Enter, pushing history and keeping the period", async () => {
    const { user, onUrlUpdate } = renderMap();

    marker("Germany").focus();
    await user.keyboard("{Enter}");

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.de",
      history: "push",
    });
  });

  it("lists the markets in ascending order of attainment in the table", async () => {
    const { user } = renderMap();

    await user.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table", { name: "Markets by attainment" });
    const germany = within(table).getByRole("row", { name: /Germany/ });
    expect(within(germany).getByText("Off track")).toBeInTheDocument();

    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("rowheader").textContent);
    expect(names).toEqual([
      "Germany",
      "Italy",
      "United Kingdom",
      "Brazil",
      "France",
      "United States",
      "Australia",
      "Mexico",
      "Canada",
      "India",
      "Japan",
      "Spain",
      "China",
    ]);
  });
});

/*
 * May 2026 growth, read off the starter pack: Germany -9.7% (lowest), China +18.2% (highest);
 * Europe from Germany -9.7% to France +11.6%. Share (the pack's kpis.sharePct): the United
 * States 8.8% (lowest), Brazil 15.0%, China 37.2% (highest).
 */
describe("MarketMap: colour by another KPI", () => {
  const colourBy = () => screen.getByRole("group", { name: "Colour map by" });

  it("switches to growth from its control, replacing history, and back to the default", async () => {
    const { user, onUrlUpdate } = renderMap();

    await user.click(
      within(colourBy()).getByRole("button", { name: "Growth" }),
    );
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?mapMetric=growth",
      history: "replace",
    });
    expect(
      within(colourBy()).getByRole("button", { name: "Growth" }),
    ).toHaveAttribute("aria-pressed", "true");

    await user.click(
      within(colourBy()).getByRole("button", { name: "Attainment" }),
    );
    expect(lastUrl(onUrlUpdate).query).toBe("");
    expect(screen.getByRole("img", { name: SUMMARY })).toBeInTheDocument();
  });

  it("reads growth into every marker, keeping the status", () => {
    renderMap({ searchParams: "?mapMetric=growth" });

    expect(marker("Germany")).toHaveAccessibleName(
      "Germany: growth -9.7%, off track",
    );
    expect(marker("Brazil")).toHaveAccessibleName(
      "Brazil: growth +2.0%, at risk",
    );
  });

  it("summarises the range of growth at the portfolio", () => {
    renderMap({ searchParams: "?mapMetric=growth" });
    expect(
      screen.getByRole("img", {
        name: "Growth in May 2026 runs from Germany at -9.7% to China at +18.2%.",
      }),
    ).toBeInTheDocument();
  });

  it("names a region in the growth summary", () => {
    renderMap({
      selected: { level: "region", id: "eu" },
      searchParams: "?mapMetric=growth",
    });
    expect(
      screen.getByRole("img", {
        name: "Growth in Europe in May 2026 runs from Germany at -9.7% to France at +11.6%.",
      }),
    ).toBeInTheDocument();
  });

  it("lists the markets by growth, lowest first, in the table", async () => {
    const { user } = renderMap({ searchParams: "?mapMetric=growth" });
    await user.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table", { name: "Markets by growth" });
    expect(
      within(table).getByRole("columnheader", { name: "Growth vs prior year" }),
    ).toBeInTheDocument();
    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("rowheader").textContent);
    expect(names.slice(0, 6)).toEqual([
      "Germany",
      "Spain",
      "Italy",
      "Brazil",
      "Australia",
      "Mexico",
    ]);
  });

  it("explains the growth colours in the legend with labelled stops", () => {
    renderMap({ searchParams: "?mapMetric=growth" });
    expect(
      screen.queryByText("No status: no forecast"),
    ).not.toBeInTheDocument();
    for (const stop of ["-10.0% or less", "0.0%", "+10.0% or more"]) {
      expect(screen.getByText(stop)).toBeInTheDocument();
    }
    expect(screen.queryByText("Hatched: off track")).not.toBeInTheDocument();
  });

  it("reads market share into the markers", () => {
    renderMap({ searchParams: "?mapMetric=share" });
    expect(marker("Brazil")).toHaveAccessibleName(
      "Brazil: market share 15.0%, at risk",
    );
  });

  it("summarises share and scales it from 0% to the highest share shown", () => {
    renderMap({ searchParams: "?mapMetric=share" });
    expect(
      screen.getByRole("img", {
        name: "Market share in May 2026 runs from United States at 8.8% to China at 37.2%.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("37.2%")).toBeInTheDocument();
  });

  it("can't colour by share outside the month the pack states it for, and says why", () => {
    renderMap({ period: "2026-04", searchParams: "?mapMetric=share" });

    const share = within(colourBy()).getByRole("button", {
      name: "Market share",
    });
    expect(share).toBeDisabled();
    expect(share).toHaveAccessibleDescription(
      "Market share is only in the data for May 2026.",
    );
    // The link asked for share; the map shows attainment instead of an empty map.
    expect(
      within(colourBy()).getByRole("button", { name: "Attainment" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(marker("Germany")).toHaveAccessibleName(/^Germany: attainment /);
  });

  it("offers share in May 2026, with no note", () => {
    renderMap();
    expect(
      within(colourBy()).getByRole("button", { name: "Market share" }),
    ).toBeEnabled();
    expect(screen.queryByText(/only in the data/)).not.toBeInTheDocument();
  });

  it("falls back to attainment for a value it doesn't know", () => {
    renderMap({ searchParams: "?mapMetric=revenue" });
    expect(screen.getByRole("img", { name: SUMMARY })).toBeInTheDocument();
  });
});

/*
 * A tiny dataset whose answers can be worked out by hand, every Q3 2026 month the same:
 * Germany growth +25%, on track; France has no forecast, so no attainment or status, but
 * growth 0%; United States growth -10%, attainment 90% (off track), alone in North America.
 */
const q3Months = ["2026-07", "2026-08", "2026-09"] as const;
const flat = (actual: number, forecast: number, priorYear: number) => ({
  nuvora: q3Months.map((period) => ({
    period,
    actual,
    units: 1,
    forecast,
    priorYear,
    marketSize: 1000,
  })),
});
const tiny = tinyDataset({
  currency: "USD",
  periods: q3Months,
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [{ id: "nuvora", name: "Nuvora" }],
  markets: [
    { id: "de", name: "Germany", regionId: "eu", series: flat(100, 100, 80) },
    { id: "fr", name: "France", regionId: "eu", series: flat(100, 0, 100) },
    {
      id: "us",
      name: "United States",
      regionId: "na",
      series: flat(90, 100, 100),
    },
  ],
  anomalies: [],
});

describe("MarketMap: markets with partial data", () => {
  it("keeps a market with no attainment on the growth map, without a status", () => {
    renderMap({
      dataset: tiny,
      period: "2026-Q3",
      searchParams: "?mapMetric=growth",
    });

    expect(marker("France")).toHaveAccessibleName("France: growth 0.0%");
    // Not a blank circle: a "no status" mark, explained in the legend.
    expect(marker("France").querySelector("svg")).not.toBeNull();
    expect(screen.getByText("No status: no forecast")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Growth in Q3 2026 runs from United States at -10.0% to Germany at +25.0%.",
      }),
    ).toBeInTheDocument();
  });

  it("names one value when the selection holds a single market", () => {
    renderMap({
      dataset: tiny,
      period: "2026-Q3",
      selected: { level: "region", id: "na" },
      searchParams: "?mapMetric=growth",
    });

    expect(
      screen.getByRole("img", {
        name: "Growth in North America in Q3 2026 is United States at -10.0%.",
      }),
    ).toBeInTheDocument();
  });
});
