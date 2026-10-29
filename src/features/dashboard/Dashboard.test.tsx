import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { datasetQuery } from "@/data/queries";
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
  render(<Dashboard />, { wrapper: Wrapper });
  return { user: userEvent.setup(), onUrlUpdate };
}

function lastUrl(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) {
  const event = onUrlUpdate.mock.calls.at(-1)?.[0];
  return { query: event?.queryString, history: event?.options.history };
}

const breadcrumb = () => screen.getByRole("navigation", { name: "Breadcrumb" });
const keyFigures = () => screen.getByRole("region", { name: "Key figures" });

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

  it("falls back to the portfolio for a link the data doesn't contain", () => {
    renderDashboard("?path=xx.YY");

    expect(within(breadcrumb()).getAllByRole("listitem")).toHaveLength(1);
    expect(keyFigures()).toHaveTextContent(/Revenue\s*\$116\.8M/);
  });

  it("describes the trend chart in words and offers it as a table", async () => {
    const { user } = renderDashboard("?path=eu.DE");

    expect(
      screen.getByRole("img", {
        name: /^Germany revenue, Oct 2024 to Sep 2026: /,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View as table" }));

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
      /^Mar 2026: revenue \$4M, forecast \$[\d.]+M, prior year \$[\d.]+M$/,
    );
  });

  it("names each line in a legend, and reads the summary once", async () => {
    const { user } = renderDashboard("?path=eu.DE");

    const legend = screen.getByRole("list", { name: "Legend" });
    expect(legend).toHaveTextContent(/Actual.*Forecast.*Prior year/);
    // Chart mode: the svg carries the summary, so the visible copy is hidden from AT.
    const summary = /^Germany revenue, Oct 2024 to Sep 2026: /;
    expect(screen.getByText(summary)).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.getByText(summary)).not.toHaveAttribute("aria-hidden");
  });

  it("picks rows to compare from the breakdown, up to four", async () => {
    const { user, onUrlUpdate } = renderDashboard("?path=eu");
    const table = screen.getByRole("table", { name: /Europe by market/ });

    await user.click(
      within(table).getByRole("checkbox", { name: "Compare Germany" }),
    );
    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu&compare=eu.DE",
      history: "replace",
    });

    for (const market of ["France", "United Kingdom", "Italy"]) {
      await user.click(
        within(table).getByRole("checkbox", { name: `Compare ${market}` }),
      );
    }
    const spain = within(table).getByRole("checkbox", {
      name: "Compare Spain",
    });
    expect(spain).toBeDisabled();
    expect(spain).toHaveAccessibleDescription("You can compare up to 4.");

    await user.click(
      within(table).getByRole("checkbox", { name: "Compare Germany" }),
    );
    expect(lastUrl(onUrlUpdate).query).toBe(
      "?path=eu&compare=eu.FR,eu.GB,eu.IT",
    );
    expect(spain).toBeEnabled();
  });
});
