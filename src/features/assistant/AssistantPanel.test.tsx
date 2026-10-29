import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { datasetQuery } from "@/data/queries";
import type { StreamEvent } from "@/domain/schema";
import { encodeSseEvent } from "@/domain/sse";
import { server, sseResponse, type TestFrame } from "@/test/msw";
import { AssistantPanel } from "./AssistantPanel";

const GERMANY_DIP = "Why did Germany's revenue dip in March 2026?";
const SUGGESTED = [GERMANY_DIP, "What will revenue be in Q1 2027?"];

const germanyMarchRevenue = {
  id: 1,
  ref: { level: "market", id: "DE" },
  period: "2026-03",
  metric: "revenue",
} as const;

function token(text: string): StreamEvent {
  return { type: "token", text };
}

function final(
  overrides: Partial<Extract<StreamEvent, { type: "final" }>> = {},
): StreamEvent {
  return {
    type: "final",
    confidence: 0.9,
    citations: [germanyMarchRevenue],
    ...overrides,
  };
}

function respondWith(frames: TestFrame[], options?: { delayMs?: number }) {
  server.use(http.post("*/api/chat", () => sseResponse(frames, options)));
}

/** The panel as the console mounts it: dataset hydrated, URL state available. */
function renderPanel({ searchParams = "" }: { searchParams?: string } = {}) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(datasetQuery.queryKey, loadDataset());
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  const Nuqs = withNuqsTestingAdapter({ searchParams, onUrlUpdate });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Nuqs>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
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
    respondWith([
      token("Germany's revenue "),
      token("fell to $4M [1]."),
      final(),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(await screen.findByText("High confidence")).toBeInTheDocument();
    const answer = screen.getByRole("article", { name: "Answer" });
    expect(answer).toHaveTextContent("Germany's revenue fell to $4M");
    expect(answer).toHaveTextContent("AI-generated · verify with sources");
  });

  it("checks a citation against the dataset, not the model's number", async () => {
    // The model misquotes the figure: the chip must show what the data says.
    respondWith([token("Germany fell to $9M [1]."), final()]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const chip = await screen.findByRole("button", {
      name: "DE · Mar 2026 · Revenue",
    });
    act(() => chip.focus());

    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Source data: Germany, Mar 2026, Revenue: $4M",
    );
  });

  it("drills the dashboard to the cited entity and period", async () => {
    respondWith([token("Germany fell [1]."), final()]);
    const { user, onUrlUpdate } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    await user.click(
      await screen.findByRole("button", { name: "DE · Mar 2026 · Revenue" }),
    );

    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        queryString: "?path=eu.DE&period=2026-03",
        options: expect.objectContaining({ history: "push" }),
      }),
    );
  });

  it("shows markers as pending until the answer's evidence arrives", async () => {
    // The marker is split across tokens, and the final event waits for the test.
    let release = () => {};
    const evidence = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.post("*/api/chat", () => {
        const encoder = new TextEncoder();
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const event of [
              token("Germany fell [1"),
              token("] in March."),
            ]) {
              controller.enqueue(encoder.encode(encodeSseEvent(event)));
            }
            await evidence;
            controller.enqueue(encoder.encode(encodeSseEvent(final())));
            controller.close();
          },
        });
        return new Response(body, {
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    expect(
      await screen.findByText("Citation 1, checking the source"),
    ).toBeInTheDocument();

    release();

    expect(
      await screen.findByRole("button", { name: "DE · Mar 2026 · Revenue" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Citation 1, checking the source"),
    ).not.toBeInTheDocument();
  });

  it("stops on request and labels what remains as partial", async () => {
    respondWith([token("One "), token("two "), token("three "), final()], {
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
  });

  it("abstains in its own card, saying what the data does cover", async () => {
    respondWith([
      {
        type: "abstain",
        reason: "The data has no forecasts beyond Sep 2026.",
        coverage: { from: "2024-10", to: "2026-09" },
      },
    ]);
    const { user } = renderPanel();

    await user.click(
      screen.getByRole("button", { name: "What will revenue be in Q1 2027?" }),
    );

    const card = await screen.findByRole("article", {
      name: "This isn't in the data",
    });
    expect(card).toHaveTextContent(
      "The data has no forecasts beyond Sep 2026.",
    );
    expect(card).toHaveTextContent("The data covers Oct 2024 to Sep 2026.");
    expect(
      screen.queryByRole("article", { name: "Answer" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the partial answer on an error and retries the same question", async () => {
    let calls = 0;
    server.use(
      http.post("*/api/chat", () => {
        calls += 1;
        return calls === 1
          ? sseResponse([
              token("Germany's five products "),
              {
                type: "error",
                message: "The answer timed out.",
                retryable: true,
              },
            ])
          : sseResponse([token("Recovered [1]."), final()]);
      }),
    );
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));
    const answer = await screen.findByRole("article", { name: "Answer" });
    await waitFor(() =>
      expect(answer).toHaveTextContent("The answer timed out."),
    );
    expect(answer).toHaveTextContent("Germany's five products");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("High confidence")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Answer" })).toHaveTextContent(
      "Recovered",
    );
    expect(calls).toBe(2);
  });

  it("explains a low-confidence answer when the assistant says why", async () => {
    respondWith([
      token("Cirrus is weaker in some markets [1]."),
      final({
        confidence: 0.42,
        uncertainty: "Only two quarters of data for the new pricing.",
      }),
    ]);
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: GERMANY_DIP }));

    expect(await screen.findByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Answer" })).toHaveTextContent(
      "Why it's uncertain: Only two quarters of data for the new pricing.",
    );
  });

  it("announces the start and the outcome, not every token", async () => {
    respondWith([token("Germany "), token("fell [1]."), final()], {
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
    respondWith([token("Typed answer [1]."), final()]);
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
});
