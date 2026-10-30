import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { datasetQuery } from "@/data/queries";
import { clearHighlight } from "@/state/highlight";
import { Toaster } from "@/ui/Toaster";
import { Dashboard } from "./Dashboard";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and
 * written down as literals, so a selector or formatting change can't silently move them.
 */

/** The dashboard as the console mounts it: dataset hydrated, URL state with memory. */
function renderDashboard(searchParams = "") {
  const queryClient = new QueryClient();
  queryClient.setQueryData(datasetQuery.queryKey, loadDataset());
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const Nuqs = withNuqsTestingAdapter({
    searchParams,
    onUrlUpdate,
    hasMemory: true,
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Nuqs>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </Nuqs>
    );
  }
  render(
    <>
      <Dashboard />
      <Toaster />
    </>,
    { wrapper: Wrapper },
  );
  return { user: userEvent.setup(), onUrlUpdate };
}

function lastUrl(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) {
  const event = onUrlUpdate.mock.calls.at(-1)?.[0];
  return { query: event?.queryString, history: event?.options.history };
}

const breadcrumb = () => screen.getByRole("navigation", { name: "Breadcrumb" });
const keyFigures = () => screen.getByRole("region", { name: "Key figures" });
const trendFigure = () =>
  screen.getByRole("figure", { name: "Germany revenue" });

describe("Dashboard", () => {
  it("shows the portfolio for the latest full quarter when the URL is empty", () => {
    renderDashboard();

    expect(within(breadcrumb()).getByText("Portfolio")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const kpis = keyFigures();
    expect(kpis).toHaveTextContent("Q3 2026");
    expect(kpis).toHaveTextContent(/Revenue\s*\$116\.8M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*97\.1%/);
    expect(within(kpis).getAllByText("At risk").length).toBeGreaterThan(0);
    expect(kpis).toHaveTextContent(/Growth vs prior year\s*\+4\.9%/);
    expect(kpis).toHaveTextContent(/Off track or at risk\s*3 of 4/);
  });

  it("drills down through the breakdown, pushing history and keeping the period", async () => {
    const { user, onUrlUpdate } = renderDashboard("?period=2026-03");

    await user.click(
      within(
        screen.getByRole("table", { name: /Portfolio by region/ }),
      ).getByRole("button", { name: "Europe" }),
    );
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?period=2026-03&path=eu",
      history: "push",
    });

    await user.click(
      within(screen.getByRole("table", { name: /Europe by market/ })).getByRole(
        "button",
        { name: "Germany" },
      ),
    );
    expect(lastUrl(onUrlUpdate).query).toBe("?period=2026-03&path=eu.DE");
    expect(breadcrumb()).toHaveTextContent(/Portfolio.*Europe.*Germany/);
  });

  it("reads the selection from the URL and goes back up from the breadcrumb", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");

    expect(within(breadcrumb()).getByText("Germany")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const kpis = keyFigures();
    expect(kpis).toHaveTextContent(/Revenue\s*\$13\.6M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*95\.4%/);
    expect(kpis).toHaveTextContent(/Off track or at risk\s*1 of 5/);

    await user.click(
      within(breadcrumb()).getByRole("button", { name: "Europe" }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu",
      history: "push",
    });
  });

  it("lets a period in the URL override the quarter, badge matching the number", () => {
    renderDashboard("?path=eu.DE&period=2026-03");

    const kpis = keyFigures();
    expect(kpis).toHaveTextContent("Mar 2026");
    expect(kpis).toHaveTextContent(/Revenue\s*\$4M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*82\.1%/);
    expect(within(kpis).getByText("Off track")).toBeInTheDocument();
    expect(kpis).toHaveTextContent(/16\.7%/);
  });

  it("falls back to the portfolio for a link the data doesn't contain, and says so", async () => {
    const { onUrlUpdate } = renderDashboard("?path=xx.YY&period=2026-03");

    expect(within(breadcrumb()).getAllByRole("listitem")).toHaveLength(1);
    // The portfolio's March figure; Europe's would be $15.6M.
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$40\.5M/);
    expect(
      await screen.findByText(
        "That link points to something not in the data, so you're seeing the portfolio.",
      ),
    ).toBeInTheDocument();
    // The bad path leaves the URL, so sharing the page doesn't pass the broken link on.
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?period=2026-03",
      history: "replace",
    });
  });

  it("describes the trend chart in words and offers it as a table", async () => {
    const { user } = renderDashboard("?path=eu.DE");

    expect(
      screen.getByRole("img", {
        name: /^Germany revenue, Oct 2024 to Sep 2026: /,
      }),
    ).toBeInTheDocument();

    await user.click(
      within(trendFigure()).getByRole("button", { name: "View as table" }),
    );

    const table = screen.getByRole("table", {
      name: /Germany revenue by month/,
    });
    const march = within(table).getByRole("row", { name: /Mar 2026/ });
    expect(march).toHaveTextContent("$4M");
    expect(
      screen.queryByRole("img", { name: /Germany revenue/ }),
    ).not.toBeInTheDocument();
  });

  it("steps through months with the keyboard and focuses one without pushing history", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");
    const september = screen.getByRole("button", {
      name: /^Sep 2026: revenue /,
    });
    expect(september).toHaveAttribute("tabindex", "0");

    act(() => september.focus());
    await user.keyboard("{ArrowLeft}");
    const august = screen.getByRole("button", { name: /^Aug 2026: revenue / });
    expect(august).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.DE&period=2026-08",
      history: "replace",
    });
    expect(keyFigures()).toHaveTextContent("Aug 2026");
  });

  it("enters the chart on the selected month, marked as current", () => {
    renderDashboard("?path=eu.DE&period=2026-03");

    const march = screen.getByRole("button", { name: /^Mar 2026: revenue / });
    expect(march).toHaveAttribute("tabindex", "0");
    expect(march).toHaveAttribute("aria-current", "date");
    expect(
      screen.getByRole("button", { name: /^Sep 2026: revenue / }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("gives each point the same figures as the table, prior year included", () => {
    renderDashboard("?path=eu.DE");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).toHaveAccessibleName(
      /^Mar 2026: revenue \$4M, forecast \$[\d.]+M, prior year \$[\d.]+M\./,
    );
  });

  it("flags an anomaly from a product on its market's trend, naming where it comes from", async () => {
    const { user } = renderDashboard("?path=eu.DE");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).toHaveAccessibleName(
      /prior year \$[\d.]+M\. Anomaly in Beacon in Germany: A distributor stock-out in Germany held back most Beacon shipments in March\.$/,
    );
    expect(
      screen.getByRole("button", { name: /^Feb 2026: revenue / }),
    ).not.toHaveAccessibleName(/Anomaly/);
    expect(
      screen.getByRole("img", { name: /^Germany revenue, / }),
    ).toHaveAccessibleName(/\. Anomaly flagged in Mar 2026\.$/);
    expect(
      within(trendFigure()).getByRole("list", { name: "Legend" }),
    ).toHaveTextContent(/Prior year.*Anomaly/);

    await user.click(
      within(trendFigure()).getByRole("button", { name: "View as table" }),
    );
    const table = screen.getByRole("table", {
      name: /Germany revenue by month/,
    });
    expect(
      within(table).getByRole("columnheader", { name: "Anomaly" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("row", { name: /Mar 2026/ }),
    ).toHaveTextContent("Beacon in Germany: A distributor stock-out");
    expect(
      within(table).getByRole("row", { name: /Apr 2026/ }),
    ).not.toHaveTextContent("stock-out");
  });

  it("flags an anomaly on the entity it belongs to without repeating its name", () => {
    renderDashboard("?path=eu.DE.beacon");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).toHaveAccessibleName(
      /prior year \$[\d.]+M\. Anomaly: A distributor stock-out in Germany/,
    );
  });

  it("lists every anomaly month at the portfolio, from different entities", () => {
    renderDashboard("");

    expect(
      screen.getByRole("img", { name: /^Portfolio revenue, / }),
    ).toHaveAccessibleName(/\. Anomalies flagged in Mar 2026 and Apr 2026\.$/);
  });

  it("adds no anomaly column or legend item where the selection has none", async () => {
    const { user } = renderDashboard("?path=na.US");
    const usTrend = screen.getByRole("figure", {
      name: "United States revenue",
    });

    expect(
      within(usTrend).getByRole("list", { name: "Legend" }),
    ).not.toHaveTextContent("Anomaly");
    await user.click(
      within(usTrend).getByRole("button", { name: "View as table" }),
    );
    const table = screen.getByRole("table", {
      name: /United States revenue by month/,
    });
    expect(
      within(table).queryByRole("columnheader", { name: "Anomaly" }),
    ).not.toBeInTheDocument();
  });

  it("keeps anomaly markers out of the executive view", () => {
    renderDashboard("?path=eu.DE&mode=exec");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).not.toHaveAccessibleName(/Anomaly/);
    expect(
      screen.getByRole("img", { name: /^Germany revenue, / }),
    ).not.toHaveAccessibleName(/Anomaly/);
    expect(
      within(trendFigure()).getByRole("list", { name: "Legend" }),
    ).not.toHaveTextContent("Anomaly");
  });

  it("names each line in a legend, and reads the summary once", async () => {
    const { user } = renderDashboard("?path=eu.DE");

    const legend = within(trendFigure()).getByRole("list", { name: "Legend" });
    expect(legend).toHaveTextContent(/Actual.*Forecast.*Prior year/);
    // Chart mode: the svg carries the summary, so the visible copy is hidden from AT.
    const summary = /^Germany revenue, Oct 2024 to Sep 2026: /;
    expect(screen.getByText(summary)).toHaveAttribute("aria-hidden", "true");

    await user.click(
      within(trendFigure()).getByRole("button", { name: "View as table" }),
    );
    expect(screen.getByText(summary)).not.toHaveAttribute("aria-hidden");
  });

  it("ticks the compared rows, up to four, starting from the radar's defaults", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu");
    const table = screen.getByRole("table", { name: /Europe by market/ });
    const box = (market: string) =>
      within(table).getByRole("checkbox", { name: `Compare ${market}` });

    // The radar's default comparison shows as ticked, so the boxes match the chart.
    for (const market of ["Germany", "France", "United Kingdom", "Italy"]) {
      expect(box(market)).toBeChecked();
    }
    expect(box("Spain")).toBeDisabled();
    expect(box("Spain")).toHaveAccessibleDescription(
      "You can compare up to 4.",
    );

    // Unticking one keeps the other three rather than collapsing to one.
    await user.click(box("Germany"));
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu&compare=eu.FR,eu.GB,eu.IT",
      history: "replace",
    });
    expect(box("Spain")).toBeEnabled();

    await user.click(box("Spain"));
    expect(lastUrl(onUrlUpdate).query).toBe(
      "?path=eu&compare=eu.FR,eu.GB,eu.IT,eu.ES",
    );
  });

  it("compares the rows ticked in the breakdown", async () => {
    const { user } = renderDashboard("?path=eu");
    const table = screen.getByRole("table", { name: /Europe by market/ });

    for (const market of ["France", "United Kingdom", "Italy", "Spain"]) {
      await user.click(
        within(table).getByRole("checkbox", { name: `Compare ${market}` }),
      );
    }

    const compare = screen.getByRole("figure", { name: "Compare" });
    const legend = within(compare).getByRole("list", { name: "Legend" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(2);
    expect(legend).toHaveTextContent(/Germany.*Spain/);
  });

  it("compares the new level's children after a drill", async () => {
    const { user } = renderDashboard("?path=eu&compare=eu.DE,eu.ES");
    const table = screen.getByRole("table", { name: /Europe by market/ });

    await user.click(within(table).getByRole("button", { name: "Germany" }));

    // Markets picked at Europe don't apply to Germany's products.
    const compare = screen.getByRole("figure", { name: "Compare" });
    const legend = within(compare).getByRole("list", { name: "Legend" });
    expect(legend).not.toHaveTextContent(/Spain/);
    expect(legend).toHaveTextContent(/in Germany/);
  });

  it("focuses a month from the heat map, and the key figures follow", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");

    await user.click(
      screen.getByRole("button", { name: /^Beacon in Germany, Mar 2026: / }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.DE&period=2026-03",
      history: "replace",
    });
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$4M/);
  });

  it("drills to a market from the map", async () => {
    const { user, onUrlUpdate } = renderDashboard();

    await user.click(
      await screen.findByRole("button", { name: /^Germany: attainment / }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.DE",
      history: "push",
    });
    expect(breadcrumb()).toHaveTextContent(/Portfolio.*Europe.*Germany/);
  });

  it("shows every panel in analyst mode, the default", () => {
    renderDashboard("?path=eu.DE");

    expect(keyFigures()).toHaveTextContent(/Units\s*141\.9K/);
    expect(keyFigures()).toHaveTextContent(/Market share\s*17\.0%/);
    expect(
      within(trendFigure()).getByRole("list", { name: "Legend" }),
    ).toHaveTextContent("Prior year");
    expect(screen.getByRole("figure", { name: "Compare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyst" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the dense panels in exec mode", () => {
    renderDashboard("?path=eu.DE&mode=exec");

    expect(keyFigures()).not.toHaveTextContent("Units");
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$13\.6M/);
    expect(
      within(trendFigure()).getByRole("list", { name: "Legend" }),
    ).not.toHaveTextContent("Prior year");
    expect(
      screen.queryByRole("figure", { name: "Compare" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("figure", { name: /and month$/ }),
    ).not.toBeInTheDocument();
  });

  it("switches mode from the toggle, replacing history", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");

    await user.click(screen.getByRole("button", { name: "Exec" }));
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.DE&mode=exec",
      history: "replace",
    });
    expect(screen.getByRole("button", { name: "Exec" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Analyst" }));
    expect(lastUrl(onUrlUpdate).query).toBe("?path=eu.DE");
  });

  it("drills from a top risk, and the other panels follow", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=latam&period=2026-Q2");
    const risks = screen.getByRole("region", { name: "Top risks" });

    await user.click(within(risks).getByRole("button", { name: "Brazil" }));

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=latam.BR&period=2026-Q2",
      history: "push",
    });
    expect(within(breadcrumb()).getByText("Brazil")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("table", { name: /Brazil by product/ }),
    ).toBeInTheDocument();
  });

  it("keeps the top risks in exec mode, without the movers", () => {
    renderDashboard("?path=latam&mode=exec");

    expect(
      screen.getByRole("region", { name: "Top risks" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Biggest movers" }),
    ).not.toBeInTheDocument();
  });

  it("goes up a level on Escape from inside the dashboard, pushing history", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE&period=2026-03");
    const march = within(trendFigure()).getByRole("button", {
      name: /^Mar 2026:/,
    });

    act(() => march.focus());
    await user.keyboard("{Escape}");

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu&period=2026-03",
      history: "push",
    });
  });

  it("ignores Escape outside the dashboard", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");
    // Stands in for the chat input beside the dashboard.
    const chatInput = document.createElement("input");
    document.body.append(chatInput);

    act(() => chatInput.focus());
    await user.keyboard("{Escape}");
    expect(onUrlUpdate).not.toHaveBeenCalled();
    chatInput.remove();
  });

  it("does nothing on Escape at the portfolio", async () => {
    const { user, onUrlUpdate } = renderDashboard();

    act(() => screen.getByRole("button", { name: "Analyst" }).focus());
    await user.keyboard("{Escape}");
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("moves the radar and the heat map when a month is chosen on the trend", async () => {
    const { user } = renderDashboard("?path=eu");
    const radar = () => screen.getByRole("figure", { name: "Compare" });
    // Heat-map cells are named "<child>, <month>: …"; the one in the tab order is the entry.
    const heatMapTabStop = () =>
      within(screen.getByRole("figure", { name: /and month$/ }))
        .getAllByRole("button", { name: /, \w{3} \d{4}: / })
        .filter((cell) => cell.tabIndex === 0);
    expect(within(radar()).getByRole("img")).toHaveAccessibleName(/in Q3 2026/);

    await user.click(
      within(screen.getByRole("figure", { name: "Europe revenue" })).getByRole(
        "button",
        { name: /^Mar 2026:/ },
      ),
    );

    expect(within(radar()).getByRole("img")).toHaveAccessibleName(
      /in Mar 2026/,
    );
    // The heat map enters keyboard users on the chosen month's column.
    // Exactly one cell is the tab stop, and it's in the chosen month's column.
    expect(heatMapTabStop()).toHaveLength(1);
    expect(heatMapTabStop()[0]).toHaveAccessibleName(/, Mar 2026: /);
  });

  it("moves focus to the key figures after Escape, so the next Escape still works", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");
    act(() =>
      within(screen.getByRole("table", { name: /Germany by product/ }))
        .getAllByRole("checkbox")[0]
        ?.focus(),
    );

    await user.keyboard("{Escape}");
    expect(keyFigures()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(lastUrl(onUrlUpdate).query).toBe("");
  });

  it("goes up on Escape when nothing has focus, as after a click in Safari", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.DE");
    act(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });

    await user.keyboard("{Escape}");
    expect(lastUrl(onUrlUpdate).query).toBe("?path=eu");
  });
});

describe("Dashboard: linked highlighting", () => {
  // The highlight store is module-level, so each test starts with nothing highlighted.
  afterEach(() => act(() => clearHighlight()));

  const linked = (element: HTMLElement | undefined) =>
    element?.getAttribute("data-linked") === "true";
  const marker = (name: string) =>
    screen.getByRole("button", { name: new RegExp(`^${name}: attainment`) });
  // getByRole throws if the row is missing, so a renamed row fails here, not in an assertion.
  const tableRow = (name: string) => {
    const row = within(
      screen.getByRole("table", { name: /by (market|region)/ }),
    )
      .getByRole("button", { name })
      .closest("tr");
    if (row === null) throw new Error(`No table row for ${name}`);
    return row;
  };

  it("emphasises a hovered table row's market on the map, heat map and radar", async () => {
    const { user } = renderDashboard("?path=eu");

    await user.hover(tableRow("Germany"));

    expect(linked(marker("Germany"))).toBe(true);
    expect(linked(marker("France"))).toBe(false);
    expect(
      linked(screen.getByRole("button", { name: /^Germany, Mar 2026: / })),
    ).toBe(true);
    expect(
      linked(screen.getByRole("button", { name: /^Germany, Revenue: / })),
    ).toBe(true);
    expect(linked(tableRow("France"))).toBe(false);

    await user.unhover(tableRow("Germany"));
    expect(linked(marker("Germany"))).toBe(false);
  });

  it("emphasises a focused map marker's row in the table, for keyboard users", () => {
    renderDashboard("?path=eu");

    act(() => marker("France").focus());

    expect(linked(tableRow("France"))).toBe(true);
    expect(linked(tableRow("Germany"))).toBe(false);
  });

  it("links a region's row to its markets on the map at the portfolio", async () => {
    const { user } = renderDashboard();

    await user.hover(tableRow("Europe"));

    expect(linked(marker("Germany"))).toBe(true);
    expect(linked(marker("United States"))).toBe(false);
  });

  it("clears the highlight when a hovered row is drilled into", async () => {
    const { user } = renderDashboard("?path=eu");

    await user.hover(tableRow("Germany"));
    await user.click(
      within(tableRow("Germany")).getByRole("button", { name: "Germany" }),
    );

    // Without clearing, "eu.DE" would link every one of Germany's products.
    expect(
      screen.getByRole("table", { name: /Germany by product/ }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('[data-linked="true"]')).toHaveLength(0);
  });

  it("emphasises a hovered market among the top risks", async () => {
    const { user } = renderDashboard("?path=latam&period=2026-Q2");
    const risks = screen.getByRole("region", { name: "Top risks" });

    await user.hover(tableRow("Brazil"));

    const brazil = within(risks)
      .getByRole("button", { name: "Brazil" })
      .closest("li");
    expect(brazil?.getAttribute("data-linked")).toBe("true");
  });
});
