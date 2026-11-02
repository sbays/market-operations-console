import { TestDataset } from "@/test/dataset";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearHighlight } from "@/state/highlight";
import { LiveRegions } from "@/ui/LiveRegions";
import { Toaster } from "@/ui/Toaster";
import { Dashboard } from "./Dashboard";

/*
 * Expected figures are read off the starter pack (src/pack/data.json) once and written down
 * as literals, so a selector or formatting change can't silently move them. The pack runs
 * Jun 2024 to May 2026; with no period in the URL the dashboard shows May 2026.
 */

/** The dashboard as the console mounts it: dataset hydrated, URL state with memory. */
function renderDashboard(searchParams = "") {
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
  render(
    <>
      <Dashboard />
      <Toaster />
      <LiveRegions />
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
  it("shows the portfolio for the pack's latest month when the URL is empty", () => {
    renderDashboard();

    expect(within(breadcrumb()).getByText("Portfolio")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const kpis = keyFigures();
    expect(kpis).toHaveTextContent("May 2026");
    expect(kpis).toHaveTextContent(/Revenue\s*\$22\.9M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*100\.4%/);
    expect(within(kpis).getAllByText("On track").length).toBeGreaterThan(0);
    expect(kpis).toHaveTextContent(/Growth vs prior year\s*\+7\.3%/);
    // Europe is the one region at risk.
    expect(kpis).toHaveTextContent(/Off track or at risk\s*1 of 4/);
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
    expect(lastUrl(onUrlUpdate).query).toBe("?period=2026-03&path=eu.de");
    expect(breadcrumb()).toHaveTextContent(/Portfolio.*Europe.*Germany/);
  });

  it("reads the selection from the URL and goes back up from the breadcrumb", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-Q1");

    expect(within(breadcrumb()).getByText("Germany")).toHaveAttribute(
      "aria-current",
      "page",
    );
    const kpis = keyFigures();
    expect(kpis).toHaveTextContent(/Revenue\s*\$4\.6M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*91\.9%/);
    expect(kpis).toHaveTextContent(/Off track or at risk\s*5 of 5/);

    await user.click(
      within(breadcrumb()).getByRole("button", { name: "Europe" }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu&period=2026-Q1",
      history: "push",
    });
  });

  it("lets a period in the URL override the quarter, badge matching the number", () => {
    renderDashboard("?path=eu.de&period=2026-03");

    const kpis = keyFigures();
    expect(kpis).toHaveTextContent("Mar 2026");
    expect(kpis).toHaveTextContent(/Revenue\s*\$1\.2M/);
    expect(kpis).toHaveTextContent(/Forecast attainment\s*92\.2%/);
    expect(within(kpis).getByText("Off track")).toBeInTheDocument();
    // The pack's March dip: 31% down on the prior year.
    expect(kpis).toHaveTextContent(/Growth vs prior year\s*-31\.0%/);
  });

  it("picks a quarter or a month from the period picker", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-03");
    const picker = screen.getByRole("combobox", { name: "Period" });
    expect(picker).toHaveDisplayValue("Mar 2026");

    await user.selectOptions(picker, "Q1 2026");
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.de&period=2026-Q1",
      history: "replace",
    });
    expect(keyFigures()).toHaveTextContent("Q1 2026");
    // Q2 2026 has only April and May in the pack, so it isn't offered.
    expect(
      within(picker).queryByRole("option", { name: "Q2 2026" }),
    ).not.toBeInTheDocument();
  });

  it("pins the shown month into a link without a period, so a shared link never drifts", async () => {
    const { onUrlUpdate } = renderDashboard("?path=eu.de");

    await waitFor(() =>
      expect(lastUrl(onUrlUpdate)).toEqual({
        query: "?path=eu.de&period=2026-05",
        history: "replace",
      }),
    );
    expect(screen.getByRole("combobox", { name: "Period" })).toHaveDisplayValue(
      "May 2026",
    );
  });

  it("pins the shown month in place of a period the data doesn't cover", async () => {
    const { onUrlUpdate } = renderDashboard("?path=eu.de&period=2030-Q1");

    await waitFor(() =>
      expect(lastUrl(onUrlUpdate).query).toBe("?path=eu.de&period=2026-05"),
    );
  });

  it("falls back to the portfolio for a link the data doesn't contain, and says so", async () => {
    const { onUrlUpdate } = renderDashboard("?path=xx.YY&period=2026-03");

    expect(within(breadcrumb()).getAllByRole("listitem")).toHaveLength(1);
    // The portfolio's March figure; Europe's would be $6.4M.
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$21\.2M/);
    const notice =
      "That link points to something not in the data, so you're seeing the portfolio.";
    // Read aloud through the polite live region, and shown as a toast (sonner's region).
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(notice),
    );
    expect(
      await within(
        screen.getByRole("region", { name: /Notifications/ }),
      ).findByText(notice),
    ).toBeInTheDocument();
    // The bad path leaves the URL, so sharing the page doesn't pass the broken link on.
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?period=2026-03",
      history: "replace",
    });
  });

  it("describes the trend chart in words and offers it as a table", async () => {
    const { user } = renderDashboard("?path=eu.de");

    expect(
      screen.getByRole("img", {
        name: /^Germany revenue, Jun 2024 to May 2026: /,
      }),
    ).toBeInTheDocument();

    await user.click(
      within(trendFigure()).getByRole("button", { name: "View as table" }),
    );

    const table = screen.getByRole("table", {
      name: /Germany revenue by month/,
    });
    const march = within(table).getByRole("row", { name: /Mar 2026/ });
    expect(march).toHaveTextContent("$1.2M");
    expect(
      screen.queryByRole("img", { name: /Germany revenue/ }),
    ).not.toBeInTheDocument();
  });

  it("steps through months with the keyboard and focuses one without pushing history", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de");
    const may = screen.getByRole("button", {
      name: /^May 2026: revenue /,
    });
    expect(may).toHaveAttribute("tabindex", "0");

    act(() => may.focus());
    await user.keyboard("{ArrowLeft}");
    const april = screen.getByRole("button", { name: /^Apr 2026: revenue / });
    expect(april).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.de&period=2026-04",
      history: "replace",
    });
    expect(keyFigures()).toHaveTextContent("Apr 2026");
  });

  it("enters the chart on the selected month, marked as current", () => {
    renderDashboard("?path=eu.de&period=2026-03");

    const march = screen.getByRole("button", { name: /^Mar 2026: revenue / });
    expect(march).toHaveAttribute("tabindex", "0");
    expect(march).toHaveAttribute("aria-current", "date");
    expect(
      screen.getByRole("button", { name: /^May 2026: revenue / }),
    ).toHaveAttribute("tabindex", "-1");
  });

  it("gives each point the same figures as the table, prior year included", () => {
    renderDashboard("?path=eu.de");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).toHaveAccessibleName(
      /^Mar 2026: revenue \$1\.2M, forecast \$[\d.]+M, prior year \$[\d.]+M\./,
    );
  });

  it("flags the pack's anomaly on its market's trend, in its own words", async () => {
    const { user } = renderDashboard("?path=eu.de");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).toHaveAccessibleName(
      /prior year \$[\d.]+M\. Anomaly: Revenue fell 27% versus the prior month\.$/,
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
    ).toHaveTextContent("Revenue fell 27% versus the prior month.");
    expect(
      within(table).getByRole("row", { name: /Apr 2026/ }),
    ).not.toHaveTextContent("Revenue fell");
  });

  it("flags a market's anomaly on its region's trend, naming the market", () => {
    renderDashboard("?path=eu");

    expect(
      within(screen.getByRole("figure", { name: "Europe revenue" })).getByRole(
        "button",
        { name: /^Mar 2026: revenue / },
      ),
    ).toHaveAccessibleName(
      /Anomaly in Germany: Revenue fell 27% versus the prior month\.$/,
    );
  });

  it("keeps a market's anomaly off its products' trends", () => {
    renderDashboard("?path=eu.de.nuvora");

    expect(
      screen.getByRole("button", { name: /^Mar 2026: revenue / }),
    ).not.toHaveAccessibleName(/Anomaly/);
  });

  it("lists the anomaly month at the portfolio", () => {
    renderDashboard("");

    expect(
      screen.getByRole("img", { name: /^Portfolio revenue, / }),
    ).toHaveAccessibleName(/\. Anomaly flagged in Mar 2026\.$/);
  });

  it("adds no anomaly column or legend item where the selection has none", async () => {
    const { user } = renderDashboard("?path=na.us");
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
    renderDashboard("?path=eu.de&mode=exec");

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
    const { user } = renderDashboard("?path=eu.de");

    const legend = within(trendFigure()).getByRole("list", { name: "Legend" });
    expect(legend).toHaveTextContent(/Actual.*Forecast.*Prior year/);
    // Chart mode: the svg carries the summary, so the visible copy is hidden from AT.
    const summary = /^Germany revenue, Jun 2024 to May 2026: /;
    expect(screen.getByText(summary)).toHaveAttribute("aria-hidden", "true");

    await user.click(
      within(trendFigure()).getByRole("button", { name: "View as table" }),
    );
    expect(screen.getByText(summary)).not.toHaveAttribute("aria-hidden");
  });

  it("ticks the compared rows, up to four, starting from the radar's defaults", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu&period=2026-Q1");
    const table = screen.getByRole("table", { name: /Europe by market/ });
    const box = (market: string) =>
      within(table).getByRole("checkbox", { name: `Compare ${market}` });

    // The radar's default comparison shows as ticked, so the boxes match the chart.
    for (const market of ["Germany", "United Kingdom", "France", "Italy"]) {
      expect(box(market)).toBeChecked();
    }
    expect(box("Spain")).toBeDisabled();
    expect(box("Spain")).toHaveAccessibleDescription(
      "You can compare up to 4.",
    );

    // Unticking one keeps the other three rather than collapsing to one.
    await user.click(box("Germany"));
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu&period=2026-Q1&compare=eu.gb,eu.fr,eu.it",
      history: "replace",
    });
    expect(box("Spain")).toBeEnabled();

    await user.click(box("Spain"));
    expect(lastUrl(onUrlUpdate).query).toBe(
      "?path=eu&period=2026-Q1&compare=eu.gb,eu.fr,eu.it,eu.es",
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
    const { user } = renderDashboard("?path=eu&compare=eu.de,eu.es");
    const table = screen.getByRole("table", { name: /Europe by market/ });

    await user.click(within(table).getByRole("button", { name: "Germany" }));

    // Markets picked at Europe don't apply to Germany's products.
    const compare = screen.getByRole("figure", { name: "Compare" });
    const legend = within(compare).getByRole("list", { name: "Legend" });
    expect(legend).not.toHaveTextContent(/Spain/);
    expect(legend).toHaveTextContent(/in Germany/);
  });

  it("focuses a month from the heat map, and the key figures follow", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de");

    await user.click(
      screen.getByRole("button", { name: /^Nuvora in Germany, Mar 2026: / }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.de&period=2026-03",
      history: "replace",
    });
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$1\.2M/);
  });

  it("drills to a market from the map", async () => {
    const { user, onUrlUpdate } = renderDashboard("?period=2026-Q1");

    await user.click(
      await screen.findByRole("button", { name: /^Germany: attainment / }),
    );

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?period=2026-Q1&path=eu.de",
      history: "push",
    });
    expect(breadcrumb()).toHaveTextContent(/Portfolio.*Europe.*Germany/);
  });

  it("shows every panel in analyst mode, the default", () => {
    renderDashboard("?path=eu.de");

    expect(keyFigures()).toHaveTextContent(/Units\s*7\.6K/);
    // The pack's own share for Germany in May 2026.
    expect(keyFigures()).toHaveTextContent(/Market share\s*8\.9%/);
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
    renderDashboard("?path=eu.de&mode=exec");

    expect(keyFigures()).not.toHaveTextContent("Units");
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$1\.7M/);
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
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-Q1");

    await user.click(screen.getByRole("button", { name: "Exec" }));
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.de&period=2026-Q1&mode=exec",
      history: "replace",
    });
    expect(screen.getByRole("button", { name: "Exec" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Analyst" }));
    expect(lastUrl(onUrlUpdate).query).toBe("?path=eu.de&period=2026-Q1");
  });

  it("drills from a top risk, and the other panels follow", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=latam&period=2026-05");
    const risks = screen.getByRole("region", { name: "Top risks" });

    await user.click(within(risks).getByRole("button", { name: "Brazil" }));

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=latam.br&period=2026-05",
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
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-03");
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
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-Q1");
    // Stands in for the chat input beside the dashboard.
    const chatInput = document.createElement("input");
    document.body.append(chatInput);

    act(() => chatInput.focus());
    await user.keyboard("{Escape}");
    expect(onUrlUpdate).not.toHaveBeenCalled();
    chatInput.remove();
  });

  it("does nothing on Escape at the portfolio", async () => {
    const { user, onUrlUpdate } = renderDashboard("?period=2026-Q1");

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
    expect(within(radar()).getByRole("img")).toHaveAccessibleName(
      /in May 2026/,
    );

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
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-Q1");
    act(() =>
      within(screen.getByRole("table", { name: /Germany by product/ }))
        .getAllByRole("checkbox")[0]
        ?.focus(),
    );

    await user.keyboard("{Escape}");
    expect(keyFigures()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(lastUrl(onUrlUpdate).query).toBe("?period=2026-Q1");
  });

  it("goes up on Escape when nothing has focus, as after a click in Safari", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu.de&period=2026-Q1");
    act(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });

    await user.keyboard("{Escape}");
    expect(lastUrl(onUrlUpdate).query).toBe("?path=eu&period=2026-Q1");
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

    // Without clearing, "eu.de" would link every one of Germany's products.
    expect(
      screen.getByRole("table", { name: /Germany by product/ }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('[data-linked="true"]')).toHaveLength(0);
  });

  it("emphasises a hovered market among the top risks", async () => {
    const { user } = renderDashboard("?path=latam&period=2026-05");
    const risks = screen.getByRole("region", { name: "Top risks" });

    await user.hover(tableRow("Brazil"));

    const brazil = within(risks)
      .getByRole("button", { name: "Brazil" })
      .closest("li");
    expect(brazil?.getAttribute("data-linked")).toBe("true");
  });
});
