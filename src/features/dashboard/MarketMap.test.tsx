import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { datasetQuery } from "@/data/queries";
import { countryOf } from "@/domain/geo";
import type { EntityRef, PeriodRef } from "@/domain/schema";
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
}: { selected?: EntityRef; period?: PeriodRef; searchParams?: string } = {}) {
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
    <MarketMap dataset={loadDataset()} selected={selected} period={period} />,
    { wrapper: Wrapper },
  );
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
