import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import {
  withNuqsTestingAdapter,
  type OnUrlUpdateFunction,
} from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { loadDataset } from "@/data/pack";
import { datasetQuery } from "@/data/queries";
import { AlertRuleInputSchema, type AlertRule } from "@/domain/alert";
import { server } from "@/test/msw";
import { Toaster } from "@/ui/Toaster";
import { AlertDialog } from "./AlertDialog";
import { AlertList } from "./AlertList";

/*
 * The form and the list share one query cache, as they do on the page. The server is MSW:
 * a save waits on `gate` so a test can see the optimistic row before the response lands.
 */

// jsdom has no pointer capture; sonner calls it when a toast is pressed (the Retry button).
Element.prototype.setPointerCapture ??= () => undefined;

type Harness = {
  user: ReturnType<typeof userEvent.setup>;
  /** Lets the pending save answer. */
  release: () => void;
  /** Lets a held refetch of the list answer (only with holdRefetch). */
  releaseRefetch: () => void;
  /** Lets the held first load of the list answer (only with holdFirstList). */
  releaseFirstList: () => void;
  onUrlUpdate: ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;
};

/** The saves the mock has accepted, in order; a failed save is never added. */
let saved: AlertRule[] = [];
let postCount = 0;
let listCount = 0;

/**
 * Serves the list and the save. With `holdRefetch`, every list request after the first waits
 * for releaseRefetch, so a test can tell a rollback from the refetch that follows a save.
 */
function serveAlerts(
  initial: AlertRule[],
  holdRefetch: boolean,
  holdFirstList: boolean,
) {
  saved = initial;
  postCount = 0;
  listCount = 0;
  const gates = { save: () => {}, refetch: () => {}, firstList: () => {} };
  const saveGate = new Promise<void>((resolve) => {
    gates.save = resolve;
  });
  const refetchGate = new Promise<void>((resolve) => {
    gates.refetch = resolve;
  });
  const firstListGate = new Promise<void>((resolve) => {
    gates.firstList = resolve;
  });
  server.use(
    http.get("*/api/alerts", async () => {
      listCount += 1;
      if (holdRefetch && listCount > 1) await refetchGate;
      // The list as it was when the request arrived, as a real server would answer it.
      const rules = saved;
      if (holdFirstList && listCount === 1) await firstListGate;
      return HttpResponse.json({ rules });
    }),
    http.post("*/api/alerts", async ({ request }) => {
      postCount += 1;
      const body = AlertRuleInputSchema.parse(await request.json());
      await saveGate;
      if (new URL(request.url).searchParams.get("fail") === "1") {
        return HttpResponse.json({ error: "Saving failed" }, { status: 500 });
      }
      const rule: AlertRule = { ...body, id: crypto.randomUUID() };
      saved = [...saved, rule];
      return HttpResponse.json(rule, { status: 201 });
    }),
  );
  return gates;
}

function renderAlerts(
  searchParams = "",
  {
    initial = [],
    holdRefetch = false,
    holdFirstList = false,
  }: {
    initial?: AlertRule[];
    holdRefetch?: boolean;
    holdFirstList?: boolean;
  } = {},
): Harness {
  const { save, refetch, firstList } = serveAlerts(
    initial,
    holdRefetch,
    holdFirstList,
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
    <>
      <AlertDialog />
      <AlertList />
      <Toaster />
    </>,
    { wrapper: Wrapper },
  );
  return {
    user: userEvent.setup(),
    release: save,
    releaseRefetch: refetch,
    releaseFirstList: firstList,
    onUrlUpdate,
  };
}

/** The rules list only exists once there is at least one rule, so it is awaited. */
const rulesList = () => screen.findByRole("list", { name: "Alert rules" });

async function openDialog(user: Harness["user"]) {
  await user.click(screen.getByRole("button", { name: "New alert" }));
  return screen.getByRole("dialog", { name: "New alert rule" });
}

/** Fills the form the way a reviewer would, leaving anything not named as the default. */
async function fillRule(
  user: Harness["user"],
  {
    name,
    scope = ["Germany"],
    metric,
    threshold,
  }: {
    name: string;
    scope?: string[];
    metric?: "Growth vs prior year" | "Forecast attainment";
    threshold: string;
  },
) {
  await user.type(screen.getByRole("textbox", { name: "Rule name" }), name);
  for (const market of scope) {
    const box = screen.getByRole("checkbox", { name: market });
    // A scope the URL already prefilled is ticked; clicking it would untick it.
    if (!(box instanceof HTMLInputElement) || !box.checked) {
      await user.click(box);
    }
  }
  if (metric) await user.click(screen.getByRole("radio", { name: metric }));
  await user.type(
    screen.getByRole("spinbutton", { name: "Threshold" }),
    threshold,
  );
}

describe("AlertDialog", () => {
  it("shows the error summary on an empty submit and moves focus to it", async () => {
    const { user } = renderAlerts();
    const dialog = await openDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));

    const summary = await within(dialog).findByRole("alert");
    expect(
      within(summary).getByRole("heading", { name: "Fix these before saving" }),
    ).toBeInTheDocument();
    expect(summary).toHaveFocus();
    expect(
      within(summary).getByRole("button", { name: "Give the rule a name." }),
    ).toBeInTheDocument();
  });

  it("links each error to its field and marks the field invalid", async () => {
    const { user } = renderAlerts();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    await within(dialog).findByRole("alert");

    const name = within(dialog).getByRole("textbox", { name: "Rule name" });
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Give the rule a name.");

    const scope = within(dialog).getByRole("group", { name: "Scope" });
    expect(scope).toHaveAccessibleDescription(
      "Pick at least one region or market.",
    );
    expect(
      within(scope).getByRole("checkbox", { name: "Europe" }),
    ).toBeInvalid();

    const threshold = within(dialog).getByRole("spinbutton", {
      name: "Threshold",
    });
    expect(threshold).toHaveAttribute("aria-invalid", "true");
    expect(threshold).toHaveAccessibleDescription(
      expect.stringContaining("Enter the threshold as a number."),
    );
  });

  it("moves focus to a field when its error in the summary is chosen", async () => {
    const { user } = renderAlerts();
    const dialog = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    await within(dialog).findByRole("alert");

    await user.click(
      within(dialog).getByRole("button", { name: "Give the rule a name." }),
    );

    expect(
      within(dialog).getByRole("textbox", { name: "Rule name" }),
    ).toHaveFocus();
  });

  it("prefills the scope from the selection in the URL", async () => {
    const { user } = renderAlerts("?path=eu.DE");
    const dialog = await openDialog(user);

    expect(
      within(dialog).getByRole("checkbox", { name: "Germany" }),
    ).toBeChecked();
    expect(
      within(dialog).getByRole("checkbox", { name: "France" }),
    ).not.toBeChecked();
  });

  it("takes the threshold range from the chosen metric", async () => {
    const { user, release } = renderAlerts();
    release();
    const dialog = await openDialog(user);
    await fillRule(user, {
      name: "Big growth",
      metric: "Growth vs prior year",
      threshold: "300",
    });
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    // 300 is a valid growth threshold, so the dialog closes and the rule is saved.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    const again = await openDialog(user);
    await fillRule(user, {
      name: "Attainment check",
      metric: "Forecast attainment",
      threshold: "300",
    });
    await user.click(within(again).getByRole("button", { name: "Save rule" }));

    expect(await within(again).findByRole("alert")).toBeInTheDocument();
    expect(
      within(again).getByRole("spinbutton", { name: "Threshold" }),
    ).toHaveAccessibleDescription(
      expect.stringContaining("Attainment thresholds run from 0% to 200%."),
    );
  });

  it("saves a valid rule at once as Saving…, then as saved", async () => {
    const { user, release } = renderAlerts("?path=eu.DE");
    const dialog = await openDialog(user);
    await fillRule(user, {
      name: "Watch Germany",
      metric: "Forecast attainment",
      threshold: "95",
    });

    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));

    // The dialog closes and the optimistic row shows while the server is still answering.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const rules = await rulesList();
    expect(await within(rules).findByText("Watch Germany")).toBeInTheDocument();
    expect(within(rules).getByText("Saving…")).toBeInTheDocument();

    release();
    await waitFor(() =>
      expect(within(rules).queryByText("Saving…")).not.toBeInTheDocument(),
    );
    expect(within(rules).getByText("Watch Germany")).toBeInTheDocument();
    expect(saved).toHaveLength(1);
    // The saved rule replaces the optimistic row in place: no refetch, which on a deployed
    // mock could reach another server instance that never saw the rule.
    expect(listCount).toBe(1);
    // Screen-reader users hear the save land, through the toast's live region.
    expect(
      await screen.findByText("Saved alert rule “Watch Germany”."),
    ).toBeInTheDocument();
  });
});

describe("AlertList", () => {
  it("says there are no rules until one is saved", async () => {
    renderAlerts();
    expect(await screen.findByText("No alert rules yet.")).toBeInTheDocument();
  });

  it("describes each rule in one line", async () => {
    renderAlerts("", {
      initial: [
        {
          id: "r1",
          name: "Watch Germany",
          scope: ["eu.DE", "eu.FR"],
          metric: "attainment",
          operator: "below",
          threshold: 95,
        },
      ],
    });

    const rules = await rulesList();
    expect(within(rules).getByText("Watch Germany")).toBeInTheDocument();
    expect(
      within(rules).getByText(
        "Forecast attainment below 95.0% in Germany, France",
      ),
    ).toBeInTheDocument();
  });
});

describe("a save before the list has loaded", () => {
  it("keeps the rules the server already had, alongside the new one", async () => {
    const existing: AlertRule = {
      id: "r1",
      name: "Existing rule",
      scope: ["apac"],
      metric: "attainment",
      operator: "below",
      threshold: 95,
    };
    const { user, release, releaseFirstList } = renderAlerts("?path=eu.DE", {
      initial: [existing],
      holdFirstList: true,
    });
    expect(screen.getByText("Loading alert rules…")).toBeInTheDocument();

    const dialog = await openDialog(user);
    await fillRule(user, { name: "Watch Germany", threshold: "0" });
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    release();
    releaseFirstList();

    const rules = await rulesList();
    expect(await within(rules).findByText("Existing rule")).toBeInTheDocument();
    expect(within(rules).getByText("Watch Germany")).toBeInTheDocument();
  });
});

describe("the markets a rule flags", () => {
  const apacRule: AlertRule = {
    id: "r1",
    name: "APAC attainment",
    scope: ["apac"],
    metric: "attainment",
    operator: "below",
    threshold: 95,
  };

  it("names the flagged markets for the period shown, and each drills to its market", async () => {
    const { user, onUrlUpdate } = renderAlerts("", { initial: [apacRule] });

    const rules = await rulesList();
    expect(
      within(rules).getByText("Flags 2 markets in Q3 2026:"),
    ).toBeInTheDocument();
    await user.click(within(rules).getByRole("button", { name: "Japan" }));
    expect(within(rules).getByRole("button", { name: "India" })).toBeVisible();

    expect(onUrlUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ queryString: "?path=apac.JP" }),
    );
  });

  it("follows the period in the URL", async () => {
    renderAlerts("?period=2025-01", {
      initial: [{ ...apacRule, threshold: 0 }],
    });
    const rules = await rulesList();
    expect(
      within(rules).getByText("No markets flagged in Jan 2025."),
    ).toBeInTheDocument();
  });

  it("says so when no market in scope crosses the threshold", async () => {
    renderAlerts("", {
      initial: [{ ...apacRule, scope: ["eu.DE", "eu.FR"] }],
    });
    const rules = await rulesList();
    expect(
      within(rules).getByText("No markets flagged in Q3 2026."),
    ).toBeInTheDocument();
  });
});

describe("a save the server refuses", () => {
  it("removes the optimistic row, shows a toast with Retry, and retries the same rule", async () => {
    // The list refetch is held, so the row can only go by the rollback, not by invalidation.
    const { user, release, releaseRefetch } = renderAlerts("?fail=1", {
      holdRefetch: true,
    });
    const dialog = await openDialog(user);
    await fillRule(user, {
      name: "Doomed",
      metric: "Forecast attainment",
      threshold: "95",
    });

    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    const rules = await rulesList();
    expect(await within(rules).findByText("Doomed")).toBeInTheDocument();
    expect(within(rules).getByText("Saving…")).toBeInTheDocument();

    release();
    // The refetch is still held, so the row going away here is the rollback's doing.
    await waitFor(() =>
      expect(screen.queryByText("Doomed")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("No alert rules yet.")).toBeInTheDocument();
    releaseRefetch();
    expect(
      await screen.findByText("Couldn't save the alert rule."),
    ).toBeInTheDocument();
    expect(saved).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(postCount).toBe(2));
  });

  it("rolls back only its own row, leaving a later save still in progress", async () => {
    const { user } = renderAlerts("");
    // "Doomed" is saved first and refused once "Kept" is also pending. Restoring Doomed's
    // snapshot (taken before Kept existed) would wrongly drop Kept. The list never refetches,
    // so only the rollback can change the rows.
    let refuse = () => {};
    const refusal = new Promise<void>((resolve) => (refuse = resolve));
    let keepSaving = () => {};
    const kept = new Promise<void>((resolve) => (keepSaving = resolve));
    let refused = false;
    server.use(
      http.get("*/api/alerts", async () => {
        await kept;
        return HttpResponse.json({ rules: [] });
      }),
      http.post("*/api/alerts", async ({ request }) => {
        const body = AlertRuleInputSchema.parse(await request.json());
        if (body.name === "Doomed") {
          await refusal;
          refused = true;
          return HttpResponse.json({ error: "Saving failed" }, { status: 500 });
        }
        await kept;
        return HttpResponse.json({ ...body, id: "kept" }, { status: 201 });
      }),
    );

    let dialog = await openDialog(user);
    await fillRule(user, { name: "Doomed", threshold: "5" });
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    const rules = await rulesList();
    expect(await within(rules).findByText("Doomed")).toBeInTheDocument();

    dialog = await openDialog(user);
    await fillRule(user, { name: "Kept", threshold: "5" });
    await user.click(within(dialog).getByRole("button", { name: "Save rule" }));
    expect(await within(rules).findByText("Kept")).toBeInTheDocument();

    refuse();
    await waitFor(() => expect(refused).toBe(true));
    await waitFor(() =>
      expect(screen.queryByText("Doomed")).not.toBeInTheDocument(),
    );
    expect(within(rules).getByText("Kept")).toBeInTheDocument();
    expect(within(rules).getByText("Saving…")).toBeInTheDocument();
    keepSaving();
  });
});
