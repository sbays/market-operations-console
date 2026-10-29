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
import { useDataset } from "@/data/useDataset";
import { selectionPeriod } from "@/domain/selectors";
import { useSelection } from "@/state/url";
import { DetailTable } from "./DetailTable";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and written
 * down as literals. Europe's children in Q3 2026 are the five European markets, in data order:
 * Germany, France, United Kingdom, Italy, Spain.
 */

/** Reads the selection from the URL exactly as the dashboard does, then renders the table. */
function Harness() {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  return (
    <DetailTable
      dataset={dataset}
      selected={ref}
      period={selectionPeriod(dataset, period)}
    />
  );
}

function renderTable(searchParams = "?path=eu") {
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
  render(<Harness />, { wrapper: Wrapper });
  return { user: userEvent.setup(), onUrlUpdate };
}

const table = () => screen.getByRole("table", { name: /Europe by market/ });
const column = (name: string) =>
  within(table()).getByRole("columnheader", { name });
const rowNames = () =>
  within(table())
    .getAllByRole("rowheader")
    .map((header) => header.textContent);

describe("DetailTable", () => {
  it("lists the children in data order until a column is chosen", () => {
    renderTable();

    expect(table()).toHaveAccessibleName("Europe by market · Q3 2026");
    expect(rowNames()).toEqual([
      "Germany",
      "France",
      "United Kingdom",
      "Italy",
      "Spain",
    ]);
    expect(column("Revenue")).not.toHaveAttribute("aria-sort");
  });

  it("sorts a figure descending first, then flips it", async () => {
    const { user } = renderTable();

    await user.click(
      within(column("Revenue")).getByRole("button", { name: "Revenue" }),
    );
    expect(column("Revenue")).toHaveAttribute("aria-sort", "descending");
    expect(rowNames()).toEqual([
      "Germany",
      "United Kingdom",
      "France",
      "Italy",
      "Spain",
    ]);

    await user.click(
      within(column("Revenue")).getByRole("button", { name: "Revenue" }),
    );
    expect(column("Revenue")).toHaveAttribute("aria-sort", "ascending");
    expect(rowNames()).toEqual([
      "Spain",
      "Italy",
      "France",
      "United Kingdom",
      "Germany",
    ]);
  });

  it("marks only the column it is sorted by", async () => {
    const { user } = renderTable();

    await user.click(
      within(column("Growth vs prior year")).getByRole("button", {
        name: "Growth vs prior year",
      }),
    );

    expect(column("Growth vs prior year")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    expect(column("Revenue")).not.toHaveAttribute("aria-sort");
    expect(column("Name")).not.toHaveAttribute("aria-sort");
    expect(column("Status")).not.toHaveAttribute("aria-sort");
  });

  it("sorts growth from the largest, which orders the rows differently from revenue", async () => {
    const { user } = renderTable();

    await user.click(
      within(column("Growth vs prior year")).getByRole("button", {
        name: "Growth vs prior year",
      }),
    );

    // +2.4%, +2.2%, +2.1%, +1.5%, +1.4%
    expect(rowNames()).toEqual([
      "Germany",
      "Spain",
      "United Kingdom",
      "Italy",
      "France",
    ]);
  });

  it("sorts names A to Z first, and starts a name column ascending", async () => {
    const { user } = renderTable();

    await user.click(
      within(column("Name")).getByRole("button", { name: "Name" }),
    );
    expect(column("Name")).toHaveAttribute("aria-sort", "ascending");
    expect(rowNames()).toEqual([
      "France",
      "Germany",
      "Italy",
      "Spain",
      "United Kingdom",
    ]);

    await user.click(
      within(column("Name")).getByRole("button", { name: "Name" }),
    );
    expect(column("Name")).toHaveAttribute("aria-sort", "descending");
    expect(rowNames()[0]).toBe("United Kingdom");
  });

  it("drills to a child when its name is pressed, pushing history", async () => {
    const { user, onUrlUpdate } = renderTable();

    await user.click(within(table()).getByRole("button", { name: "Germany" }));

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=eu.DE");
    expect(event?.options.history).toBe("push");
  });

  it("unticks a compared child, replacing history", async () => {
    const { user, onUrlUpdate } = renderTable();
    const germany = within(table()).getByRole("checkbox", {
      name: "Compare Germany",
    });
    expect(germany).toBeChecked();

    await user.click(germany);

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("compare=eu.FR");
    expect(event?.queryString).not.toContain("eu.DE");
    expect(event?.options.history).toBe("replace");
  });
});
