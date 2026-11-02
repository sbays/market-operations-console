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
import { type Mode, useSelection } from "@/state/url";
import { RiskMovers } from "./RiskMovers";

/*
 * Expected figures are read off the starter pack (src/pack/data.json) once and written down
 * as literals. A period the URL doesn't name is the pack's latest month, May 2026.
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
  render(<Harness mode={mode} />, { wrapper: Wrapper });
  return { user: userEvent.setup(), onUrlUpdate };
}

/** The risks section, which must be on screen for the tests that use it. */
const riskSection = () => screen.getByRole("region", { name: "Top risks" });
const topRisks = () => screen.queryByRole("region", { name: "Top risks" });
const movers = () => screen.queryByRole("region", { name: "Biggest movers" });

describe("RiskMovers: top risks", () => {
  it("puts off track first, and says why a market ahead of forecast is off track", () => {
    // Europe in May 2026: Germany 92.2% and Spain 104.7% are off track (both shrinking),
    // then Italy 93.8%, the United Kingdom 94.6% and France 96.7% at risk.
    renderRiskMovers("?path=eu");

    const risks = within(riskSection());
    expect(
      risks.getAllByRole("button").map((button) => button.textContent),
    ).toEqual(["Germany", "Spain", "Italy"]);
    expect(risks.getAllByText("Off track")).toHaveLength(2);
    expect(
      risks.getByText(
        "Revenue -4.6% on the prior year, at 104.7% of forecast.",
      ),
    ).toBeInTheDocument();
    expect(
      risks.getByText("Revenue -9.7% on the prior year, at 92.2% of forecast."),
    ).toBeInTheDocument();
  });

  it("gives the note the pack records for a market's dip in that month", () => {
    renderRiskMovers("?path=eu&period=2026-03");

    const risks = within(riskSection());
    expect(risks.getByRole("button", { name: "Germany" })).toBeInTheDocument();
    expect(
      risks.getByText("Revenue fell 27% versus the prior month."),
    ).toBeInTheDocument();
  });

  it("lists a region under forecast at the portfolio", () => {
    // Portfolio in May 2026: only Europe, 95.4%, is at risk.
    renderRiskMovers();

    const names = within(riskSection())
      .getAllByRole("button")
      .map((button) => button.textContent);
    expect(names).toEqual(["Europe"]);
    expect(
      within(riskSection()).getByText(
        "Attainment 95.4%, 4.6 points under forecast.",
      ),
    ).toBeInTheDocument();
  });

  it("says so when nothing under the selection is at risk", () => {
    renderRiskMovers("?path=na");

    expect(topRisks()).toHaveTextContent("Nothing at risk in May 2026.");
  });

  it("drills to a risk when its name is pressed, pushing history", async () => {
    const { user, onUrlUpdate } = renderRiskMovers();

    await user.click(
      within(riskSection()).getByRole("button", { name: "Europe" }),
    );

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=eu");
    expect(event?.options.history).toBe("push");
  });

  it("renders nothing below a product, where there is nothing to rank", () => {
    renderRiskMovers("?path=eu.de.veltrix");

    expect(topRisks()).toBeNull();
    expect(movers()).toBeNull();
  });
});

describe("RiskMovers: biggest movers", () => {
  it("is hidden in exec mode", () => {
    renderRiskMovers("?path=eu", "exec");

    expect(movers()).toBeNull();
    expect(topRisks()).toBeInTheDocument();
  });

  it("ranks the selection's children by growth, up and down", () => {
    renderRiskMovers("?path=eu", "analyst");

    const up = within(screen.getByRole("list", { name: "Up" }));
    expect(up.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      ["France+11.6%", "United Kingdom+8.8%", "Italy+0.3%"],
    );
    const down = within(screen.getByRole("list", { name: "Down" }));
    expect(
      down.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual(["Germany-9.7%", "Spain-4.6%"]);
  });

  it("says so when nothing declined", () => {
    renderRiskMovers("?path=latam", "analyst");

    const up = within(screen.getByRole("list", { name: "Up" }));
    expect(up.getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      ["Mexico+3.3%", "Brazil+2.0%"],
    );
    expect(screen.queryByRole("list", { name: "Down" })).toBeNull();
    expect(screen.getByText("None in May 2026.")).toBeInTheDocument();
  });

  it("drills to a mover when its name is pressed", async () => {
    const { user, onUrlUpdate } = renderRiskMovers("?path=eu", "analyst");

    await user.click(
      within(screen.getByRole("list", { name: "Down" })).getByRole("button", {
        name: "Spain",
      }),
    );

    const event = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(event?.queryString).toContain("path=eu.es");
    expect(event?.options.history).toBe("push");
  });
});
