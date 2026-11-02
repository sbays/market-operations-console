# Starter pack: data and streaming contract

This pack gives you everything behind the assistant so you can spend your time on the front-end. The "intelligence" is faked: a fixture lookup that streams a canned answer. You may use the reference endpoint as-is, or build your own equivalent. The event contract below is what matters.

## Files

- `data.json`: the canonical market operations dataset (regions, markets, products, and a monthly series). Identical for every candidate.
- `fixtures.json`: canned question to answer pairs for the assistant, including the awkward cases.
- `reference/chat-route.ts`: a ~40-line Next.js App Router handler that streams a fixture as Server-Sent Events. Drop it in at `app/api/chat/route.ts` and point the import at wherever you put `fixtures.json`.

## The streaming contract

`POST /api/chat` with a JSON body `{ "question": string }`. The response is `text/event-stream`. Each event is a single line of JSON prefixed with `data: ` and terminated by a blank line:

```
data: {"type":"token","value":"Three "}

data: {"type":"token","value":"markets "}

data: {"type":"done","kind":"normal","citations":[...],"confidence":"high"}
```

Event types:

- `token`: one chunk of the answer. `value` includes its trailing whitespace, so concatenating every `value` reconstructs the text exactly.
- `done`: the final event. Carries `kind` (`normal` | `low_confidence` | `abstain` | `error`), `citations` (array, see below), and `confidence` (`high` | `medium` | `low`).
- `error`: emitted instead of any tokens when something fails. Carries `message`. Render your error state from this.

A citation references real ids in `data.json`. Any of these fields may appear: `marketId`, `regionId`, `productId`, `period` (a `YYYY-MM` string), and `label` (a human-readable hint). Resolve them against `data.json` to link a claim back to the data it came from.

### Consuming it (reference)

Native `EventSource` is GET-only, so use streaming fetch for the POST:

```ts
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ question }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  // split on the blank line between events, parse each `data:` payload, update state
}
```

Stop generation by aborting the fetch (`AbortController`) or calling `reader.cancel()`.

## data.json shape

```jsonc
{
  "meta": { "currency": "USD", "periods": ["2024-06", ...], "latestPeriod": "2026-05", "generatedAt": "..." },
  "regions":  [{ "id": "eu", "name": "Europe" }, ...],
  "products": [{ "id": "veltrix", "name": "Veltrix" }, ...],
  "markets": [
    {
      "id": "de", "name": "Germany", "iso3": "DEU", "iso2": "DE", "regionId": "eu",
      "kpis": {
        "revenue": 0,                  // latest-period revenue across products
        "growthPct": 0,                // year on year, latest period
        "sharePct": 0,                 // market share (synthetic)
        "forecastAttainmentPct": 0,    // actual / forecast, latest period
        "status": "off_track",         // on_track | at_risk | off_track
        "anomalies": [{ "period": "2026-03", "type": "dip", "note": "..." }]
      }
    }
  ],
  "series": [
    { "marketId": "de", "productId": "veltrix", "period": "2024-06",
      "actual": 0, "forecast": 0, "units": 0, "priorYear": 0 }
  ]
}
```

`series` is the fact table: one row per market x product x month, for 24 months. Region and portfolio totals are simple sums over it. The `iso3` / `iso2` codes are for the map. `kpis` are precomputed at the latest period so your radar, scatter, and map have consistent values to render; you're free to recompute anything from `series`.

## fixtures.json shape

A `default` fallback plus a `fixtures` array. Each fixture has `keywords` (matched as case-insensitive substrings of the question, first match wins in array order), a `kind`, and an `answer` with `text`, `citations`, and `confidence`. The `error` fixture also carries an `error` message.

## Notes

- The numbers are synthetic but internally consistent. There is a deliberate story in the data so the assistant's canned answers line up with it: Germany is off-track with a sharp dip in March 2026, Italy and Brazil are at risk, and China, Japan, and the United States are ahead of or on plan.
- Keep the dataset and fixtures as the source of truth. If you extend them, stay within this contract so the front-end you build keeps working.
