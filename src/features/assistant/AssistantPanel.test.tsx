import { TestDataset } from "@/test/dataset";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { formatMetric } from "@/domain/format";
import type { DoneEvent, StreamEvent } from "@/domain/schema";
import { valueAt } from "@/domain/selectors";
import { server, sseResponse, type TestFrame } from "@/test/msw";
import { DASHBOARD_FOCUS_ID } from "@/ui/dashboardFocus";
import { AssistantPanel } from "./AssistantPanel";

const GERMANY_DIP = "Why did Germany's revenue dip in March?";
const SUGGESTED = [GERMANY_DIP, "Will sales grow next year?"];

const germanyMarch = {
  marketId: "de",
  period: "2026-03",
  label: "Germany, Mar 2026",
} as const;

/** What the data says for Germany in March 2026, as the tooltip must show it. */
const germanyMarchRevenue = formatMetric(
  "revenue",
  valueAt(loadDataset(), { level: "market", id: "de" }, "2026-03", "revenue") ??
    NaN,
);

function token(value: string): StreamEvent {
  return { type: "token", value };
}

function done(overrides: Partial<DoneEvent> = {}): DoneEvent {
  return {
    type: "done",
    kind: "normal",
    citations: [germanyMarch],
    confidence: "high",
    ...overrides,
  };
}

function respondWith(frames: TestFrame[], options?: { delayMs?: number }) {
  server.use(http.post("*/api/chat", () => sseResponse(frames, options)));
}

/** The panel as the console mounts it: dataset hydrated, URL state available. */
function renderPanel({ searchParams = "" }: { searchParams?: string } = {}) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const Nuqs = withNuqsTestingAdapter({ searchParams, onUrlUpdate });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Nuqs>
        <TestDataset>{children}</TestDataset>
      </Nuqs>
    );
  }
  render(<AssistantPanel suggestedQuestions={SUGGESTED} />, {
    wrapper: Wrapper,
  });
  return { user: userEvent.setup(), onUrlUpdate };
}

describe("AssistantPanel", () => {
  it("answers a suggested question on an AI surface with its confidence", async () => {
    respondWith([token("Germany's revenue "), token("fell in March."), done()]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(await screen.findByText("High confidence")).toBeInTheDocument();
    const answer = screen.getByRole("article", { name: "Answer" });
    expect(answer).toHaveTextContent("Germany's revenue fell in March.");
    expect(answer).toHaveTextContent("AI-generated · verify with sources");
  });

  it("lists the answer's sources once it is complete", async () => {
    respondWith([
      token("Three markets stand out."),
      done({
        citations: [
          germanyMarch,
          { regionId: "eu", period: "2026-05", label: "Europe" },
          {
            marketId: "de",
            productId: "veltrix",
            period: "2026-03",
            label: "Veltrix in Germany",
          },
        ],
      }),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const sources = await screen.findByRole("region", { name: "Sources" });

    expect(
      within(sources)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["DE · Mar 2026", "Europe · May 2026", "DE Veltrix · Mar 2026"]);
  });

  it("checks a source against the dataset, not the model's number", async () => {
    // The model misquotes the figure: the tooltip must show what the data says.
    respondWith([token("Germany fell to $9M."), done()]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const chip = await screen.findByRole("button", { name: "DE · Mar 2026" });
    act(() => chip.focus());

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Source data: Germany, Mar 2026");
    expect(tooltip).toHaveTextContent(`Revenue: ${germanyMarchRevenue}`);
    expect(tooltip).toHaveTextContent("Off track");
  });

  it("drills the dashboard to the cited entity and month, and moves focus there", async () => {
    respondWith([token("Germany fell."), done()]);
    const { user, onUrlUpdate } = renderPanel();
    // Stands in for the dashboard's key figures, which the console renders beside the panel.
    const figures = document.createElement("section");
    figures.id = DASHBOARD_FOCUS_ID;
    figures.tabIndex = -1;
    document.body.append(figures);

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    await user.click(
      await screen.findByRole("button", { name: "DE · Mar 2026" }),
    );

    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryString: "?path=eu.de&period=2026-03",
        options: expect.objectContaining({ history: "push" }),
      }),
    );
    expect(figures).toHaveFocus();
    figures.remove();
  });

  it("shows no sources until the answer's done event arrives", async () => {
    respondWith([token("Germany "), token("fell."), done()], { delayMs: 60 });
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await waitFor(() => expect(answer).toHaveTextContent("Germany"));
    expect(
      screen.queryByRole("region", { name: "Sources" }),
    ).not.toBeInTheDocument();

    expect(
      await screen.findByRole("region", { name: "Sources" }),
    ).toBeInTheDocument();
  });

  it("stops on request and labels what remains as partial, with no sources", async () => {
    respondWith([token("One "), token("two "), token("three "), done()], {
      delayMs: 50,
    });
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await waitFor(() => expect(answer).toHaveTextContent("One"));
    await user.click(screen.getByRole("button", { name: "Stop" }));

    expect(answer).toHaveTextContent("Stopped · partial answer");
    expect(answer).toHaveTextContent("One");
    expect(
      screen.queryByRole("button", { name: "Stop" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("High confidence")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Sources" }),
    ).not.toBeInTheDocument();
  });

  it("abstains in its own card: the assistant's reason, and what the data covers", async () => {
    respondWith([
      token("I can't answer that. "),
      token("The data **ends** in May 2026."),
      done({ kind: "abstain", citations: [], confidence: "low" }),
    ]);
    const { user } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "Will sales grow next year?" }),
    );

    const card = await screen.findByRole("article", {
      name: "This isn't in the data",
    });
    expect(card).toHaveTextContent("I can't answer that.");
    expect(card).toHaveTextContent("AI-generated · verify with sources");
    expect(screen.getByText("ends").tagName).toBe("STRONG");
    expect(card).toHaveTextContent("The data covers Jun 2024 to May 2026.");
    expect(
      screen.queryByRole("article", { name: "Answer" }),
    ).not.toBeInTheDocument();
  });

  it("shows the pack's error, which arrives before any text, and retries the same question", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/chat", () => {
        calls += 1;
        return calls === 1
          ? sseResponse([
              { type: "error", message: "The model service timed out." },
            ])
          : sseResponse([token("Recovered."), done()]);
      }),
    );
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await waitFor(() =>
      expect(answer).toHaveTextContent("The model service timed out."),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Answer" })).toHaveTextContent(
      "Recovered",
    );
    expect(calls).toBe(2);
  });

  it("keeps the partial answer when an error interrupts it", async () => {
    respondWith([
      token("Germany's five products "),
      { type: "error", message: "The answer timed out." },
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await waitFor(() =>
      expect(answer).toHaveTextContent("The answer timed out."),
    );
    expect(answer).toHaveTextContent("Germany's five products");
  });

  it("says in words that a low-confidence answer is tentative", async () => {
    respondWith([
      token("The shortfall is concentrated in a few markets."),
      done({ kind: "low_confidence", confidence: "low" }),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(await screen.findByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Answer" })).toHaveTextContent(
      "flagged this answer as tentative",
    );
  });

  it("adds no caveat line to a normal answer, whatever its band", async () => {
    respondWith([token("APAC grew faster."), done({ confidence: "medium" })]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(await screen.findByText("Medium confidence")).toBeInTheDocument();
    expect(screen.queryByText(/tentative/)).not.toBeInTheDocument();
  });

  it("says when an answer cites nothing", async () => {
    respondWith([token("Mixed."), done({ citations: [] })]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(
      await screen.findByText(
        "No sources cited: nothing here is checked against the data.",
      ),
    ).toBeInTheDocument();
  });

  it("announces the start and the outcome, not every token", async () => {
    respondWith([token("Germany "), token("fell."), done()], {
      delayMs: 50,
    });
    const { user } = renderPanel();
    const status = screen.getByRole("status");

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    expect(status).toHaveTextContent("Reading the data…");
    expect(
      await screen.findByText("Reading the data…", { ignore: "[role=status]" }),
    ).toBeInTheDocument();

    await waitFor(() => expect(status).toHaveTextContent("Answer ready."));
    expect(status).not.toHaveTextContent("Germany");
  });

  it("asks a typed question, and won't send an empty one", async () => {
    respondWith([token("Typed answer."), done()]);
    const { user } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Ask about the data" });

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(
      screen.queryByRole("article", { name: "Answer" }),
    ).not.toBeInTheDocument();

    await user.type(input, "  Anything at all?  {Enter}");

    expect(await screen.findByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Answer" })).toHaveTextContent(
      "Typed answer",
    );
    expect(input).toHaveValue("");
  });

  it("won't drill to a cited entity the data doesn't contain, and says so in the model's words", async () => {
    respondWith([
      token("New Zealand grew."),
      done({
        citations: [
          { marketId: "nz", period: "2026-03", label: "New Zealand" },
        ],
      }),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    await screen.findByText("High confidence");

    expect(
      within(screen.getByRole("region", { name: "Sources" })).queryByRole(
        "button",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("New Zealand · not in the data"),
    ).toBeInTheDocument();
  });

  it("doesn't turn links in the answer into live links", async () => {
    respondWith([
      token("See [the report](https://example.com/report)."),
      done(),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await screen.findByText("High confidence");

    expect(answer).toHaveTextContent("See the report");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says why an empty question wasn't sent", async () => {
    const { user } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Ask about the data" });

    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(input).toHaveAccessibleDescription("Type a question first.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveFocus();

    await user.type(input, "W");
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});
