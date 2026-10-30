/**
 * The mock alert store: lists and saves rules in memory. A mock by design (CLAUDE.md): nothing
 * persists beyond the server instance, and there is no auth or database.
 */
import {
  AlertRuleInputSchema,
  normaliseScope,
  type AlertRule,
} from "@/domain/alert";
import type { Dataset } from "@/domain/schema";

export type AlertsHandlerOptions = {
  /** What scope paths are checked against: the schema alone can't see the data. */
  dataset: Dataset;
  /** Pause before a successful save answers, so the optimistic row is visible. */
  saveDelayMs: number;
  /** Pause before a `?fail=1` save answers, so the rollback is visible. */
  failDelayMs: number;
  /** The rules saved so far. Defaults to a fresh empty list. */
  store?: AlertRule[];
};

/** Resolves after `ms`; zero resolves straight away. */
function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createAlertsHandlers(options: AlertsHandlerOptions) {
  const store = options.store ?? [];

  async function GET(): Promise<Response> {
    return Response.json({ rules: store });
  }

  async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid alert rule" }, { status: 400 });
    }
    const parsed = AlertRuleInputSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid alert rule" }, { status: 400 });
    }

    const scope = normaliseScope(options.dataset, parsed.data.scope);
    if (!scope.ok) {
      return Response.json(
        {
          error: `Scope must name regions or markets in the data, not: ${scope.invalid.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // The failure switch is how reviewers and tests reach the rollback deterministically.
    if (new URL(request.url).searchParams.get("fail") === "1") {
      await delay(options.failDelayMs);
      return Response.json({ error: "Saving failed" }, { status: 500 });
    }

    await delay(options.saveDelayMs);
    const rule: AlertRule = {
      ...parsed.data,
      scope: scope.scope,
      id: crypto.randomUUID(),
    };
    store.push(rule);
    return Response.json(rule, { status: 201 });
  }

  return { GET, POST };
}
