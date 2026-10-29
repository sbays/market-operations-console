import { describe, expect, it } from "vitest";
import { AlertRuleSchema, type AlertRule } from "@/domain/alert";
import { createAlertsHandlers } from "./handler";

const rule = {
  name: "Europe attainment",
  scope: ["eu.DE", "eu.FR"],
  metric: "attainment",
  operator: "below",
  threshold: 95,
} as const;

function setup() {
  const store: AlertRule[] = [];
  const handlers = createAlertsHandlers({
    failDelayMs: 0,
    saveDelayMs: 0,
    store,
  });
  return { store, ...handlers };
}

const post = (
  POST: (request: Request) => Promise<Response>,
  body: unknown,
  query = "",
) =>
  POST(
    new Request(`http://localhost/api/alerts${query}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("GET /api/alerts", () => {
  it("lists the saved rules, starting empty", async () => {
    const { GET } = setup();
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rules: [] });
  });
});

describe("POST /api/alerts", () => {
  it("saves a valid rule and answers 201 with its id", async () => {
    const { POST, store } = setup();
    const response = await post(POST, {
      ...rule,
      name: "  Europe attainment  ",
    });

    expect(response.status).toBe(201);
    const saved = AlertRuleSchema.parse(await response.json());
    expect(saved).toEqual({
      ...rule,
      name: "Europe attainment",
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(store).toEqual([saved]);
  });

  it("lists the rule after it is saved", async () => {
    const { GET, POST } = setup();
    await post(POST, rule);
    const response = await GET();
    expect(await response.json()).toEqual({
      rules: [expect.objectContaining({ name: "Europe attainment" })],
    });
  });

  it("answers 400 and saves nothing when the body is not JSON", async () => {
    const { POST, store } = setup();
    const response = await post(POST, "not json");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid alert rule" });
    expect(store).toEqual([]);
  });

  it("answers 400 and saves nothing when the rule breaks the schema", async () => {
    const { POST, store } = setup();
    // Attainment cannot be 300%: the range refinement must run on the server too.
    for (const body of [
      { ...rule, threshold: 300 },
      { ...rule, scope: [] },
      { ...rule, metric: "revenue" },
      { name: "missing everything else" },
    ]) {
      const response = await post(POST, body);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Invalid alert rule" });
    }
    expect(store).toEqual([]);
  });

  it("answers 500 and saves nothing when ?fail=1 is set", async () => {
    const { POST, store } = setup();
    const response = await post(POST, rule, "?fail=1");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Saving failed" });
    expect(store).toEqual([]);
  });

  it("saves normally for any other value of fail", async () => {
    const { POST, store } = setup();
    const response = await post(POST, rule, "?fail=0");
    expect(response.status).toBe(201);
    expect(store).toHaveLength(1);
  });
});
