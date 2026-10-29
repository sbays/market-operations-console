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
import { useDataset } from "@/data/useDataset";
import { selectionPeriod } from "@/domain/selectors";
import { useSelection } from "@/state/url";
import { AttainmentHeatMap } from "./AttainmentHeatMap";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and
 * written down as literals, so a selector or formatting change can't silently move them.
 */

/** Reads the URL the way the dashboard does, so the heat map sees the same selection. */
function Harness() {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  return (
    <AttainmentHeatMap
      dataset={dataset}
      selected={ref}
      period={selectionPeriod(dataset, period)}
    />
  );
}

function renderHeatMap(searchParams = "") {
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
  const { container } = render(<Harness />, { wrapper: Wrapper });
  return { user: userEvent.setup(), onUrlUpdate, container };
}

function lastUrl(onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>) {
  const event = onUrlUpdate.mock.calls.at(-1)?.[0];
  return { query: event?.queryString, history: event?.options.history };
}

/** Every grid cell is a button whose name ends in its month and figure. */
const cells = () =>
  screen.getAllByRole("button", { name: /, [A-Z][a-z]{2} \d{4}: / });

describe("AttainmentHeatMap", () => {
  it("draws five products by twenty-four months at a region's market", () => {
    renderHeatMap("?path=eu.DE");

    expect(
      screen.getByRole("img", {
        name: /^Lowest: Beacon in Germany, Mar 2026, at 44\.6% of forecast\.$/,
      }),
    ).toBeInTheDocument();
    expect(cells()).toHaveLength(5 * 24);
  });

  it("names the weakest cell in the grid in its chart name", () => {
    renderHeatMap("?path=eu.DE");

    expect(
      screen.getByRole("img", {
        name: /Beacon in Germany, Mar 2026, at 44\.6%/,
      }),
    ).toBeInTheDocument();
  });

  it("moves focus to the same month in the next row with ArrowDown and to the next month with ArrowRight", async () => {
    const { user } = renderHeatMap("?path=eu.DE");

    const atlasJune = screen.getByRole("button", {
      name: /^Atlas in Germany, Jun 2026: /,
    });
    act(() => atlasJune.focus());

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: /^Beacon in Germany, Jun 2026: / }),
    ).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: /^Beacon in Germany, Jul 2026: / }),
    ).toHaveFocus();
  });

  it("selects a month with Enter, replacing history", async () => {
    const { user, onUrlUpdate } = renderHeatMap("?path=eu.DE");

    const beaconMarch = screen.getByRole("button", {
      name: /^Beacon in Germany, Mar 2026: 44\.6% of forecast$/,
    });
    act(() => beaconMarch.focus());
    await user.keyboard("{Enter}");

    expect(lastUrl(onUrlUpdate)).toEqual({
      query: "?path=eu.DE&period=2026-03",
      history: "replace",
    });
  });

  it("renders nothing at a product, which has no children", () => {
    const { container } = renderHeatMap("?path=eu.DE.atlas");

    expect(container).toBeEmptyDOMElement();
  });

  it("offers the values as a table with one row per product", async () => {
    const { user } = renderHeatMap("?path=eu.DE");

    await user.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table", {
      name: /Germany attainment by month/,
    });
    const beacon = within(table).getByRole("row", {
      name: /Beacon in Germany/,
    });
    expect(within(beacon).getByText("44.6%")).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /Lowest: / }),
    ).not.toBeInTheDocument();
  });
});
