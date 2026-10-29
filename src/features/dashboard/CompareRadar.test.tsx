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
import { CompareRadar } from "./CompareRadar";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and
 * written down as literals. The radar's period is the dashboard's: the latest full quarter,
 * Q3 2026, when the URL names none.
 */

/** Reads the selection from the URL exactly as the dashboard does, then renders the radar. */
function Harness() {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  return (
    <CompareRadar
      dataset={dataset}
      selected={ref}
      period={selectionPeriod(dataset, period)}
    />
  );
}

function renderRadar(searchParams = "") {
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
  return { user: userEvent.setup() };
}

const legend = () => screen.getByRole("list", { name: "Legend" });

describe("CompareRadar", () => {
  it("compares the first four markets of the selected region when nothing is picked", () => {
    renderRadar("?path=eu");

    expect(
      screen.getByRole("img", {
        name: /^Comparing Germany, France, United Kingdom and Italy in Q3 2026 /,
      }),
    ).toBeInTheDocument();
    expect(legend()).toHaveTextContent(/^GermanyFranceUnited KingdomItaly$/);
  });

  it("compares exactly the entities the URL names, in the order it names them", () => {
    renderRadar("?path=eu&compare=eu.DE,na.US");

    expect(legend()).toHaveTextContent(/^GermanyUnited States$/);
    expect(
      screen.getByRole("img", {
        name: /^Comparing Germany and United States in Q3 2026 on revenue/,
      }),
    ).toHaveAccessibleName(/United States leads on revenue\.$/);
  });

  it("renders nothing below a product, where there is nothing to compare", () => {
    renderRadar("?path=eu.DE.atlas");

    expect(
      screen.queryByRole("img", { name: /^Comparing/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Compare")).not.toBeInTheDocument();
  });

  it("names each vertex with its real formatted value", () => {
    renderRadar("?path=eu&compare=eu.DE,na.US");

    expect(
      screen.getByRole("button", { name: "Germany, Revenue: $13.6M" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Germany, Growth vs prior year: +2.4%",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "United States, Forecast attainment: 99.2%",
      }),
    ).toBeInTheDocument();
  });

  it("moves focus between vertices with the arrow keys", async () => {
    const { user } = renderRadar("?path=eu&compare=eu.DE,na.US");
    const germanyRevenue = screen.getByRole("button", {
      name: "Germany, Revenue: $13.6M",
    });
    expect(germanyRevenue).toHaveAttribute("tabindex", "0");

    act(() => germanyRevenue.focus());
    await user.keyboard("{ArrowRight}");
    expect(
      screen.getByRole("button", { name: "Germany, Units: 141.9K" }),
    ).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(
      screen.getByRole("button", { name: "United States, Units: 315K" }),
    ).toHaveFocus();
  });

  it("shows the raw values and the scaled share in the table alternative", async () => {
    const { user } = renderRadar("?path=eu&compare=eu.DE,na.US");

    await user.click(screen.getByRole("button", { name: "View as table" }));

    const table = screen.getByRole("table", { name: "Compared values" });
    const germany = within(table).getByRole("row", { name: /^Germany/ });
    expect(germany).toHaveTextContent("$13.6M");
    expect(germany).toHaveTextContent("95.4%");
    expect(germany).toHaveTextContent("scaled 45.0%");
    expect(
      screen.queryByRole("img", { name: /^Comparing/ }),
    ).not.toBeInTheDocument();
  });
});
