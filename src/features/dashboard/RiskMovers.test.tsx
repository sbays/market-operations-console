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
import { type Mode, useSelection } from "@/state/url";
import { RiskMovers } from "./RiskMovers";

/*
 * Expected figures are read off the generated data pack (src/pack/data.json) once and written
 * down as literals. A period the URL doesn't name is the latest full quarter, Q3 2026.
 */

/** Reads the selection from the URL exactly as the dashboard does, then renders the panel. */
function Harness({ mode }: { mode: Mode }) {
  const dataset = useDataset();
  const { ref, period } = useSelection();
  return (
    <RiskMovers
      dataset={dataset}
      selected={ref}
      period={selectionPeriod(dataset, period)}
      mode={mode}
    />
  );
}

function renderRiskMovers(searchParams = "", mode: Mode = "exec") {
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
  render(<Harness mode={mode} />, { wrapper: Wrapper });
  return { user: userEvent.setup(), onUrlUpdate };
}

/** The risks section, which must be on screen for the tests that use it. */
const riskSection = () => screen.getByRole("region", { name: "Top risks" });
const topRisks = () => screen.queryByRole("region", { name: "Top risks" });
const movers = () => screen.queryByRole("region", { name: "Biggest movers" });

describe("RiskMovers: top risks", () => {
  it("names the risk and gives the note the data records for it", () => {
    // Latin America in Q2 2026: Brazil is 85.4%, off track, and has an April currency note.
    renderRiskMovers("?path=latam&period=2026-Q2");

    const risks = within(riskSection());
    expect(risks.getByRole("button", { name: "Brazil" })).toBeInTheDocument();
    expect(risks.getByText("Off track")).toBeInTheDocument();
    expect(risks.getByText("85.4%")).toBeInTheDocument();
    expect(
      risks.getByText(
        "Demand in Brazil softened after the April currency devaluation and has not recovered.",
      ),
    ).toBeInTheDocument();
    expect(risks.queryByRole("button", { name: "Mexico" })).toBeNull();
  });

  it("lists the lowest attainment first", () => {
    // Portfolio in Q2 2026: Latin America 91.2% (off track), Asia Pacific 94.4% (at risk).
    renderRiskMovers("?period=2026-Q2");

    const names = within(riskSection())
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Latin America", "Asia Pacific"]);
    expect(
      within(riskSection()).getByText(
        "Attainment 91.2%, 8.8 points under forecast.",
      ),
    ).toBeInTheDocument();
  });

  it("uses the stock-out note for Beacon in Germany in Q1 2026", () => {
    renderRiskMovers("?path=eu.DE&period=2026-Q1");

    const risks = within(riskSection());
    expect(
      risks.getByRole("button", { name: "Beacon in Germany" }),
    ).toBeInTheDocument();
    expect(risks.getByText("81.1%")).toBeInTheDocument();
    expect(
      risks.getByText(
        "A distributor stock-out in Germany held back most Beacon shipments in March.",
      ),
    ).toBeInTheDocument();
  });

  it("says so when nothing under the selection is at risk", () => {
    renderRiskMovers("?path=na");

    expect(topRisks()).toHaveTextContent("Nothing at risk in Q3 2026.");
  });

  it("drills to a risk when its name is pressed, pushing history", async () => {
    const { user, onUrlUpdate } = renderRiskMovers("?period=2026-Q2");

    await user.click(
      within(riskSection()).getByRole("button", { name: "Latin America" }),
    );

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=latam");
    expect(event?.options.history).toBe("push");
  });

  it("renders nothing below a product, where there is nothing to rank", () => {
    renderRiskMovers("?path=eu.DE.atlas");

    expect(topRisks()).toBeNull();
    expect(movers()).toBeNull();
  });
});

describe("RiskMovers: biggest movers", () => {
  it("is hidden in exec mode", () => {
    renderRiskMovers("?path=eu&period=2026-Q3", "exec");

    expect(movers()).toBeNull();
    expect(topRisks()).toBeInTheDocument();
  });

  it("ranks the selection's children by growth, up and down", () => {
    renderRiskMovers("?path=eu&period=2026-Q3", "analyst");

    const up = within(screen.getByRole("list", { name: "Up" }));
    expect(up.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      ["Germany+2.4%", "Spain+2.2%", "United Kingdom+2.1%"],
    );
    const down = within(screen.getByRole("list", { name: "Down" }));
    expect(
      down.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["France+1.4%", "Italy+1.5%"]);
  });

  it("drills to a mover when its name is pressed", async () => {
    const { user, onUrlUpdate } = renderRiskMovers(
      "?path=eu&period=2026-Q3",
      "analyst",
    );

    await user.click(
      within(screen.getByRole("list", { name: "Up" })).getByRole("button", {
        name: "Spain",
      }),
    );

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=eu.ES");
    expect(event?.options.history).toBe("push");
  });
});
