import { TestDataset } from "@/test/dataset";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDataset } from "@/data/useDataset";
import { selectionPeriod } from "@/domain/selectors";
import { useSelection } from "@/state/url";
import { DetailTable } from "./DetailTable";

/*
 * Expected figures are read off the starter pack (src/pack/data.json) once and written down
 * as literals. Europe's children in May 2026 are the five European markets, in data order:
 * Germany, United Kingdom, France, Italy, Spain.
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

    expect(table()).toHaveAccessibleName("Europe by market · May 2026");
    expect(rowNames()).toEqual([
      "Germany",
      "United Kingdom",
      "France",
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
      "United Kingdom",
      "Germany",
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
      "Germany",
      "United Kingdom",
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

    // +11.6%, +8.8%, +0.3%, -4.6%, -9.7%
    expect(rowNames()).toEqual([
      "France",
      "United Kingdom",
      "Italy",
      "Spain",
      "Germany",
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

  it("leaves out the share column where no child has a share", () => {
    renderTable("?path=eu&period=2026-04");
    expect(
      within(table()).queryByRole("columnheader", { name: /Market share/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the share column in May 2026", () => {
    renderTable();
    expect(
      within(table()).getByRole("columnheader", { name: /Market share/ }),
    ).toBeInTheDocument();
  });

  it("drills to a child when its name is pressed, pushing history", async () => {
    const { user, onUrlUpdate } = renderTable();

    await user.click(within(table()).getByRole("button", { name: "Germany" }));

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=eu.de");
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
    expect(event?.queryString).toContain("compare=eu.gb,eu.fr,eu.it");
    expect(event?.queryString).not.toContain("eu.de");
    expect(event?.options.history).toBe("replace");
  });
});
