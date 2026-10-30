import { TestDataset } from "@/test/dataset";
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
import {
  DatasetSchema,
  type Dataset,
  type EntityRef,
  type PeriodRef,
} from "@/domain/schema";
import { MarketMap } from "./MarketMap";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and
 * written down as literals. Q3 2026 attainment: Brazil 85.5% (off track), Germany 95.4%
 * (at risk), four of twelve markets flagged.
 */

const PORTFOLIO: EntityRef = { level: "portfolio" };
const Q3: PeriodRef = "2026-Q3";

function renderMap({
  selected = PORTFOLIO,
  period = Q3,
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
  "4 of 12 markets are off track or at risk in Q3 2026; the lowest is Brazil at 85.5%.";

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
        name: "1 of 5 markets in Europe is off track or at risk in Q3 2026; the lowest is Germany at 95.4%.",
      }),
    ).toBeInTheDocument();
  });

  it("summarises the selected market on its own", () => {
    renderMap({
      selected: { level: "product", marketId: "DE", id: "atlas" },
    });

    expect(
      screen.getByRole("img", {
        name: "Germany: attainment 95.4%, at risk, in Q3 2026.",
      }),
    ).toBeInTheDocument();
  });

  it("gives every market a labelled marker with its attainment and status", () => {
    renderMap();

    expect(screen.getAllByRole("button", { name: /attainment/ })).toHaveLength(
      12,
    );
    expect(marker("Germany")).toHaveAccessibleName(
      "Germany: attainment 95.4%, at risk",
    );
    expect(marker("Brazil")).toHaveAccessibleName(
      "Brazil: attainment 85.5%, off track",
    );
    expect(marker("United States")).toHaveAccessibleName(
      "United States: attainment 99.2%, on track",
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
      query: "?path=eu.DE",
      history: "push",
    });
  });

  it("lists the markets in ascending order of attainment in the table", async () => {
    const { user } = renderMap();

    await user.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table", { name: "Markets by attainment" });
    const brazil = within(table).getByRole("row", { name: /Brazil/ });
    expect(within(brazil).getByText("Off track")).toBeInTheDocument();

    const names = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("rowheader").textContent);
    expect(names).toEqual([
      "Brazil",
      "Japan",
      "India",
      "Germany",
      "Italy",
      "Australia",
      "France",
      "United Kingdom",
      "Spain",
      "Canada",
      "United States",
      "Mexico",
    ]);
  });
});

/*
 * Q3 2026 growth, read off the data pack: Brazil -8.6% (lowest), Japan +12.5% (highest);
 * Europe from France +1.4% to Germany +2.4%. Share: India 9.4% (lowest), Brazil 11.0%,
 * Japan 24.0% (highest).
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
      "Germany: growth +2.4%, at risk",
    );
    expect(marker("Brazil")).toHaveAccessibleName(
      "Brazil: growth -8.6%, off track",
    );
  });

  it("summarises the range of growth at the portfolio", () => {
    renderMap({ searchParams: "?mapMetric=growth" });
    expect(
      screen.getByRole("img", {
        name: "Growth in Q3 2026 runs from Brazil at -8.6% to Japan at +12.5%.",
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
        name: "Growth in Europe in Q3 2026 runs from France at +1.4% to Germany at +2.4%.",
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
      "Brazil",
      "France",
      "Italy",
      "United Kingdom",
      "Spain",
      "Germany",
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
      "Brazil: market share 11.0%, off track",
    );
  });

  it("summarises share and scales it from 0% to the highest share shown", () => {
    renderMap({ searchParams: "?mapMetric=share" });
    expect(
      screen.getByRole("img", {
        name: "Market share in Q3 2026 runs from India at 9.4% to Japan at 24.0%.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("24.0%")).toBeInTheDocument();
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
  beacon: q3Months.map((period) => ({
    period,
    actual,
    units: 1,
    forecast,
    priorYear,
    marketSize: 1000,
  })),
});
const tiny = DatasetSchema.parse({
  currency: "USD",
  periods: q3Months,
  regions: [
    { id: "eu", name: "Europe" },
    { id: "na", name: "North America" },
  ],
  products: [{ id: "beacon", name: "Beacon" }],
  markets: [
    { id: "DE", name: "Germany", regionId: "eu", series: flat(100, 100, 80) },
    { id: "FR", name: "France", regionId: "eu", series: flat(100, 0, 100) },
    {
      id: "US",
      name: "United States",
      regionId: "na",
      series: flat(90, 100, 100),
    },
  ],
  anomalies: [],
});

describe("MarketMap: markets with partial data", () => {
  it("keeps a market with no attainment on the growth map, without a status", () => {
    renderMap({ dataset: tiny, searchParams: "?mapMetric=growth" });

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
