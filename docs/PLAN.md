# Market Ops Console — Implementation Plan

Oct 28, 2026 · @Simon

## Goals and guiding principles

Ship a focused, well-engineered console where both surfaces work end to end before any polish or stretch goal. The brief says it plainly: a solid, simple build beats an ambitious broken one.

What the graders weigh, and how we answer each:

- **Trust surfaces** — citations, confidence and the AI-vs-authoritative line are the heart of the brief. We design these first, not last.
- **Engineering quality** — strict TypeScript, no `any`, a typed data contract and typed stream events end to end.
- **Taste** — one coherent design system with tokens; dense but calm. One theme.
- **Coordinated views** — one selection model that drives every chart and lives in the URL.
- **Accessibility** — every chart has a table alternative, keyboard paths and non-colour encodings.
- **The README** — our own reasoning, written by us. AI drafts nothing in it verbatim.
- **AI-assisted workflow** — the brief evaluates how we use AI tools. `CLAUDE.md`, this plan and review notes are committed as evidence; keep a running log for README section (i).

Scope rules:

1. Fake the AI. Use the starter pack's mock route; extend it only to support context-aware questions.
2. No real backend, auth or data pipeline. The brief allows a mocked role switch to show role-based UI; it is not planned.
3. Stretch goals are out for the 2-day build. If day 2 finishes early, the context-aware assistant is the only candidate: the URL selection makes it nearly free.

## Stack decisions

Next.js 16 App Router with React 19 on Vercel, with TanStack Query for server state and nuqs for URL state. Each pick below names what we weighed; the README section (d) grows from this table.

| Area | Pick | Weighed against | Why |
| --- | --- | --- | --- |
| Meta-framework | Next.js 16 App Router, React 19 | Remix, TanStack Start | Route handlers host the mock SSE endpoint; RSC loads the dataset server-side; best Vercel story |
| Memoization | React Compiler (`reactCompiler: true`, decided 29 Oct) | Hand-written `useCallback`/`useMemo` | Stable callbacks and memoized renders without manual dependency arrays; its lint rules ship in `eslint-plugin-react-hooks` 7, already on via `eslint-config-next` |
| Language | TypeScript strict, `noUncheckedIndexedAccess` | — | Brief demands no `any`; ESLint bans it |
| Components | shadcn/ui on Radix primitives | MUI, Mantine, Chakra | We own the code; Radix gives keyboard and ARIA behaviour for free |
| Styling and tokens | Tailwind v4 with CSS-variable tokens | CSS Modules, vanilla-extract | Tokens in one file drive both UI and chart colours; themes switch by variable |
| Charts | visx (time-series, radar, heat map) | Recharts, ECharts, Nivo | Low-level enough for coordinated selection, custom a11y and keyboard focus; Recharts fights custom interaction |
| Map | react-simple-maps + d3-geo, TopoJSON world | Mapbox, deck.gl | A choropleth of ~12 countries needs no tiles or API keys; SVG paths are focusable |
| Server state | TanStack Query | SWR, RSC-only | Caching, optimistic mutation and rollback for the alert form |
| URL state | nuqs | Hand-rolled `useSearchParams` | Typed parsers, shallow routing, back/forward for free |
| UI state | Zustand (small) | Redux, Context | Only for ephemeral state: chat panel open, hover, stream buffer |
| Streaming | `fetch` + `ReadableStream` SSE parser | `EventSource`, Vercel AI SDK | POST bodies, `AbortController` for stop, no SDK hiding the contract we're graded on |
| Forms | React Hook Form + Zod | Formik, TanStack Form | One Zod schema types the form, the API route and the stored rules |
| Markdown in answers | react-markdown, no raw HTML, custom renderers | `dangerouslySetInnerHTML` | Safe model-output rendering; citations render as components |
| Testing | Vitest + Testing Library + MSW; Playwright + axe | Jest, Cypress | Fast, ESM-native; Playwright covers E2E and a11y scans |
| Observability | `web-vitals` to the console + per-panel error boundaries; Sentry described in the README | Datadog RUM | The brief asks us to discuss observability, not wire a vendor |

Day 1 check (done 28 Oct): react-simple-maps 5.0.5, visx 4.0.0 and react-markdown 10.1.0 all declare React 19 peer support. `@visx/xychart` also needs `@react-spring/web` as a peer. Open to swap: Recharts if visx slows down the first chart on day 1. The radar and time-series would survive the switch; the heat map would not.

## Architecture

One route, `/console`, with the dashboard as the main canvas and the assistant as a docked side panel. Both read the same selection from the URL, so the assistant always knows what the dashboard shows.

Folder layout (feature-first, shared primitives below):

```
src/
  app/
    console/page.tsx        # RSC shell, loads dataset
    api/chat/route.ts       # mock SSE endpoint (starter pack)
    api/alerts/route.ts     # mock alert rules store, deterministic ?fail=1 flag
  features/
    dashboard/              # KPI strip, map, radar, time-series, heat map, tables
    assistant/              # chat panel, stream hook, citation + confidence UI
    alerts/                 # threshold configurator form
    navigation/             # breadcrumb drill path, mode toggle, cmd-K
  data/                     # server-state layer: query keys, fetchers, TanStack hooks (useDataset, useAlertRules)
  domain/
    schema.ts               # Zod schemas for data.json + stream events
    selectors.ts            # pure derivations: rollups, top movers, at-risk counts
    format.ts               # Intl formatters
  state/
    url.ts                  # nuqs parsers: path, period, compare, mode
  ui/                       # shadcn primitives, chart shells, tokens
```

State split:

| State | Lives in | Examples |
| --- | --- | --- |
| Server (source of truth) | RSC load + TanStack Query cache | Dataset, alert rules, chat fixtures |
| Shareable view | URL via nuqs | Drill path, period, compare set, exec/analyst mode |
| Ephemeral UI | Zustand or local state | Hover, chat panel open, streaming message buffer (chat-open is deliberately not shareable) |
| Derived | Memoised selectors, never stored | Rollups, rankings, at-risk counts |

Rule of thumb: if a colleague opening the link should see it, it goes in the URL. If it's computed from data, it's never stored.

The dataset is static, so the RSC parses and validates it once with Zod and seeds the TanStack Query cache (`staleTime: Infinity`, no client refetch). Features read it through `data/useDataset`, which is the only shared way in: features never import each other, and `domain/` stays pure. Named by responsibility like `domain/`, `state/` and `ui/`, not `hooks/` (decided 28 Oct).

## Data layer

Zod schemas are the single source of types: we write the schema, infer the TypeScript type, and validate `data.json` and every stream event at the boundary. Nothing downstream re-checks shape.

- **Schemas** — `Portfolio`, `Region`, `Market` (ISO code), `Product`, `PeriodPoint` (actual, units, forecast, priorYear), `Kpis`, `Status` enum, `Anomaly`. Stream events as a discriminated union on `type`.
- **Entity ids** — one `EntityRef` type, a discriminated union on `level`, used by URL, charts and citations alike. A product appears under every market, so its variant carries the market: `{ level: 'portfolio' } | { level: 'region'; id } | { level: 'market'; id } | { level: 'product'; marketId; id }`. A citation and a map click speak the same language. (Decided 28 Oct.)
- **Selectors** — pure functions in `domain/selectors.ts`: rollup by level, growth vs prior year, attainment, top movers, at-risk count, period windows. Unit-tested hard, since every view trusts them.
- **Formatting** — one `format.ts` over `Intl.NumberFormat` and `Intl.DateTimeFormat`: compact notation (1.2M), currency in one reporting currency (USD) with the code shown, signed percentages (+4.2%), periods as "Mar 2026". Locale is a fixed `en-US` constant for server and client (decided 28 Oct): no hydration mismatch, a static page, pure formatters, and AI text and source numbers format identically. Per-user locale goes in the README as a next step.

The starter pack is not in hand, so we author our own `data.json` and fixtures following the brief's described contract (decided 28 Oct; the README says so). All data is read through a single `loadDataset()` seam, so a real pack would replace one module. Revenue is stored in one reporting currency, USD, so rollups are plain sums (decided 28 Oct).

Pack decisions (28 Oct, `feat/data-pack`):

- The pack lives in `src/pack/` (`data.json`, `fixtures.json`, `CONTRACT.md`) and is read only through `src/data/pack.ts` (`loadDataset`, `loadFixtures`); a lint rule enforces it. `pack.ts` is `server-only`: the dataset reaches the client through TanStack Query and the fixtures never leave the server.
- The dataset stores facts only (`actual`, `units`, `forecast`, `priorYear`, `marketSize` per product, market and month). Growth, attainment, share and status are selectors, so rollups are exact. Status uses quarterly attainment: on-track from 98%, at-risk from 92%, off-track below, compared on the value as displayed (one decimal), so a badge never contradicts its number (decided 28 Oct, PR #4 review). Anomalies are stored because they carry a reason.
- 24 months, Oct 2024 to Sep 2026; "this quarter" is Q3 2026. Citations may refer to a month or a quarter.
- `scripts/generate-data.ts` (seeded, deterministic) plants the stories as named adjustments. Fixtures are templates whose `{{n}}` placeholders are filled from the data, so quoted numbers match by construction; pack tests re-check it.

## Assistant surface

The assistant is where we win or lose on trust, so every answer renders as a structured card, never a bare text bubble.

**Streaming**

- `useChatStream` hook: POST to `/api/chat`, read the body with a `TextDecoder`, parse SSE frames, validate each event with Zod, append tokens to a buffer.
- Batch token updates per animation frame so long answers don't re-render per token (no jank while streaming).
- States: idle → connecting (skeleton + "Reading the data…") → streaming (caret, Stop button) → complete | stopped | error. Stop calls `AbortController.abort()` and keeps the partial answer, marked "Stopped — partial answer".
- Errors keep what streamed, show a retry, and never pretend the answer finished.
- Invalid events fail visibly (decided 28 Oct): a known event type with a bad shape aborts the stream, keeps the partial text, shows "Answer interrupted" with retry, and is logged. A dropped token or citation could silently change meaning. Unknown event types are ignored for forward compatibility.
- `aria-live="polite"` region announces start and completion only, not every token.

**Citations**

- Inline markers (decided 28 Oct): tokens contain markers like `[1]`; the final event maps each number to `{ id, ref: EntityRef, period, metric }` alongside `confidence`. Markers render as pending chips until the final event resolves them; a rehype plugin (`rehypeCitations`) turns each complete `[n]` into a citation element, so a marker split across tokens stays text until it completes.
- Each marker renders as a chip ("DE · Mar 2026 · Revenue"). Hover or focus shows the actual figure from the dataset, pulled live, not from the model.
- Clicking a chip drills the dashboard to that entity and period. Verifying is one click, and the dashboard becomes the proof.

**Confidence**

- Three bands from the numeric value: High, Medium, Low. Shown as a labelled badge with an icon and text, never colour alone.
- Low confidence adds a short "Why it's uncertain" line, only if the fixture provides the reason.
- Abstentions get their own state: a neutral card, "This isn't in the data", and what the data does cover (e.g. the last period in the dataset).

**AI vs authoritative**

- Authoritative numbers use the solid surface, tabular figures and a "Source data" label.
- AI content sits on a distinct tinted surface with a left rule, a sparkle mark and an "AI-generated · verify with sources" label.
- Numbers the AI states are never restyled as authoritative; the citation chip shows the real one beside it.

Answer-card decisions (29 Oct, `feat/answer-card`):

- The dataset reaches the client in this PR: `DatasetHydration` seeds TanStack Query from the RSC and `useDataset` reads it, so citation chips check real values from day one. The dehydrated state is built in a `"use cache"` function, because `dehydrate()` calls `Date.now()` and the static route only allows that in a cache scope.
- nuqs `path` and `period` land with the chips, so a chip click drills the URL now. The path uses the real ids, region to product (`eu.DE.beacon`); `refFromPath` rejects ids the data doesn't contain and the URL falls back to the portfolio (no toast yet).
- Answers render per Markdown block (`splitBlocks`, which keeps a loose list in one block): settled blocks keep their props, so only the growing block is re-parsed per frame. Citations reach the chips through context, so resolving them doesn't re-parse the text.
- `ChatState` is a union on `status`, and the reducer ignores everything but a new question once a run settles. HTTP failures read "The assistant isn't available right now."; the status goes to the console.

Fixture coverage to demo: the four example questions, low-confidence, abstention, error, long response. Suggested-question chips seed these on first open; they are the main way in, because free text only matches fixtures exactly and everything else abstains (decided 28 Oct).

## Dashboard

A two-mode dashboard over one shared layout: the executive view hides density, the analyst view reveals it. Same components, different props.

| Panel | Chart | Exec mode | Analyst mode | Accessible alternative |
| --- | --- | --- | --- | --- |
| Health strip | KPI tiles + sparklines | Revenue, attainment, growth, at-risk count | Adds units, share, vs prior year | Tiles are text; sparkline has `aria-label` summary |
| Top risks / movers | Ranked list | Top 3 at-risk with one-line reason | Full movers list, up and down | Already a list |
| Map | Choropleth by one KPI (attainment) | Status colour + pattern | Attainment bins with legend | Sortable table toggle; each country focusable |
| Trend | Time-series: actual vs forecast vs prior-year | Actual vs forecast only | All three + anomaly markers | Data table; keyboard steps through points |
| Compare | Radar across 5 KPIs | Hidden | Up to 4 markets or regions | Table of normalised and raw values |
| Heat map | Markets × periods, diverging scale on attainment | Hidden | Full grid, click cell to set period | Table with values; cells focusable with arrow keys |
| Detail table | Dense sortable table | Hidden | Every metric, every child of current level | Is the alternative |

Drill-down: a breadcrumb (Portfolio › Europe › Germany › Product A) is always visible. Every chart shows children of the current level, so context is never lost; Escape or the breadcrumb goes up a level.

Advanced chart pick: the heat map. It shows *when* things went wrong across markets, which the other charts don't, and it answers "Why did Germany dip in March?" visually. The scatter is not planned.

Status is never colour alone: on-track, at-risk and off-track each get an icon and label, and the map adds a hatch pattern for off-track. Diverging palette checked for colour-blind safety.

Gate decisions (29 Oct, `feat/dashboard-gate`):

- The drill-down surface for the gate is a breakdown table of the current level's children (name, revenue, attainment, status); a row's name drills in. It grows into the analyst detail table on day 2.
- With no `period` in the URL, panels show the latest full quarter; a URL month or quarter overrides it (`selectionPeriod`). Status badges use `statusAt` over the shown period, so a badge always matches the attainment beside it.
- The chart shell (`ui/ChartFrame`) draws the static chart in `<svg role="img">` with the generated summary as its name, and puts focusable data points in an HTML overlay above it: `role="img"` makes svg children presentational, so points can't live inside it. Points use a roving tabindex (`ui/useRovingIndex`); charts have no transitions.
- Breadcrumb and breakdown drills push history and keep the period; focusing a month from a chart replaces history (`useSetPeriod`).
- `/console` is a partial prerender: the shell and the assistant are static, and the dashboard's Suspense hole reads the request's `searchParams`, so it is server-rendered for each URL and streamed in the same response rather than waiting for client JavaScript. Charts still draw after hydration, because they measure their container.

Charts decisions (29 Oct, `feat/dashboard-charts`):

- `compare` holds drill paths (`eu.DE,eu.FR`), the same format as `path`, so one `EntityRef` format runs through the URL. Breakdown checkboxes toggle it (replace history), at most 4; with none ticked the radar compares the selection's first 4 children.
- The map draws countries with d3-geo and topojson-client inside the chart shell's `<svg role="img">`, with one focusable marker per market at its projected centroid in the HTML overlay, the same pattern as the trend points. Off-track markets also get a hatch pattern. It loads with `next/dynamic` (ssr off), so the world TopoJSON stays out of the first bundle. react-simple-maps was dropped: its `ComposableMap` renders its own `<svg>` (nested inside the accessible one) and makes every country a tab stop.
- The heat map shows the selection's children by month. Cells are filled with `color-mix(in oklch, var(--diverging-*) N%, var(--diverging-midpoint))`, so the diverging scale uses tokens only; arrow keys move in two dimensions (`useRovingIndex` with `columns`).
- Each chart sits in its own `ErrorBoundary`, so one failing chart leaves the dashboard working.
- Built by three parallel agents in worktrees (map, radar, heat map), each test-first on its own files; every agent's tests were mutation-checked before integration.

## Coordinated views and URL state

The URL is the selection store. Views never talk to each other; they read from and write to the URL, and everything else is derived. This keeps wiring linear: N views, one store, not N² handlers.

| Param | Example | Written by | Read by |
| --- | --- | --- | --- |
| `path` | `eu.DE.beacon` | Map click, table row, breadcrumb, citation chip, cmd-K | Every panel |
| `period` | `2026-03` | Heat map cell, time-series click | Radar, time-series (highlighted point), KPI strip, map |
| `compare` | `eu.DE,eu.FR` | Table checkboxes | Radar |
| `mode` | `exec` or `analyst` | Mode toggle | Layout |

- Drill changes push history (back button goes up a level). Hover-like changes such as period replace history, so back isn't flooded.
- Parsers are typed with nuqs and validated against the dataset; an unknown market id falls back to the portfolio with a toast, not a crash.
- The assistant receives the parsed selection with every question, which gives us the context-aware stretch goal almost for free.

## Alert configurator

A rule builder that flags markets crossing thresholds, saved optimistically and rolled back on failure. It's non-trivial enough to show real validation, not just required fields.

- **Fields** — rule name; scope (regions or specific markets, multi-select); metric (growth % or forecast attainment); operator; threshold.
- **Zod schema** — cross-field refinements: the threshold's valid range depends on the metric (growth −100 to 1000, attainment 0 to 200); at least one market in scope.
- **Save** — TanStack Query `useMutation` with `onMutate` snapshot, optimistic insert, `onError` rollback plus a toast with retry. The mock route fails when `?fail=1` is set, so reviewers and tests can trigger the rollback deterministically.
- **Errors** — inline, linked with `aria-describedby`; on submit, focus moves to an error summary at the top.

## Accessibility

Target WCAG 2.1 AA, verified by axe in CI and a manual keyboard and VoiceOver pass before submission.

- **Keyboard** — skip link; logical tab order; roving tabindex inside charts (arrow keys between points, Enter to drill, Escape to go up); cmd-K reachable; visible focus ring from tokens.
- **Charts** — every chart has a "View as table" toggle with the same data; SVGs get `role="img"` plus a generated text summary ("Germany revenue fell 12% in March, below forecast").
- **Colour** — token palette checked at 4.5:1 for text, 3:1 for UI; status always paired with icon and label; colour-blind-safe diverging scale.
- **Screen readers** — chat uses polite live regions for start and finish; confidence and AI labels are real text, not icons alone.
- **Motion** — `prefers-reduced-motion` disables chart transitions and the streaming caret animation.

Known gaps to list in the README: full screen-reader testing beyond VoiceOver, high-contrast mode, and an audio sonification of trends.

## Testing

Test where bugs would hurt trust: the numbers, the stream and the selection model. Skip snapshot tests and pixel-perfect chart assertions.

| Layer | Tool | What we cover |
| --- | --- | --- |
| Unit | Vitest | Selectors (rollups, attainment, movers), formatters across locales, SSE parser with split frames, Zod schemas, URL parsers |
| Component | Testing Library + MSW | Chat states: streaming, stop, error, abstention, low confidence; citation chip shows source value; alert form validation and rollback |
| Integration | Testing Library | Map click updates URL and table; period selection moves radar and time-series; mode toggle hides panels |
| E2E | Playwright | Happy path: open console → drill Europe › Germany → ask "Why did Germany dip?" → click citation → dashboard focuses → back button restores. Plus axe scan on each view |

Deliberately skipped: visual regression, cross-browser matrix beyond Chromium and WebKit, load testing.

## Productionising

The brief asks us to discuss productionising in README (c) and point to what we wired. Wire only the near-free things; document the rest. Everything listed under "wired" must exist in the repo so the README can point at it.

Wired:

- **CI** — GitHub Actions: typecheck, lint, unit and component tests, build, Playwright + axe against `next start` in CI. Vercel preview per PR for manual review.
- **Loading** — charts and the map lazy-loaded with `next/dynamic`; TopoJSON trimmed to needed countries.
- **RUM** — `web-vitals` reporting LCP, INP and CLS to the console.
- **Errors** — per-panel error boundary, so one broken chart doesn't take the dashboard down.
- **Safe output** — react-markdown with HTML disabled and an empty link allow-list (model links render as plain text); stream events validated before render.

Documented in the README only: Sentry error tracking, `size-limit` bundle budgets in CI, CSP and security headers (static `headers()` in `next.config.ts`), CDN caching strategy for the static dataset, feature flags, real SSO, alert storage, synthetic monitoring.

## Schedule

Two days (decided 28 Oct). Claude Code implements and Simon steers and reviews each diff. There is a hard gate at the end of day 1: both surfaces run end to end on the live Vercel URL, on our own data, before any depth or polish.

| When | Work | Done when |
| --- | --- | --- |
| Day 1, morning | Scaffold (Next 16, TS strict, Tailwind v4 tokens, shadcn, ESLint, Vitest, Playwright), GitHub Actions CI, first Vercel deploy. Our pack: `domain/schema.ts`, a seeded generator script for `data.json`, `fixtures.json`, `CONTRACT.md`. `loadDataset()`, selectors and `format.ts` with unit tests | CI green on an empty shell; schema, selectors and formatters tested |
| Day 1, afternoon | Mock `/api/chat`, SSE parser (split-frame tests), `useChatStream` with all states, rAF batching and stop. Answer card: citation chips, confidence badge, abstention card, AI surface | Every fixture streams, stops and errors correctly |
| Day 1, evening | `state/url.ts` (`path`, `mode`), `data/useDataset`, breadcrumb drill, KPI strip, chart shell with table toggle, built with the time-series as its first chart | **Gate:** live URL, chat answers with citations, dashboard drills and the URL round-trips |
| Day 2, morning | Choropleth with click-to-drill, radar with `compare`, heat map with `period`. Each through the chart shell | All four required charts have table alternatives and keyboard access |
| Day 2, midday | Exec/analyst modes, top risks and movers, detail table. Citation chip drills the dashboard. Alert form with optimistic save and `?fail=1` rollback | Coordinated views work across panels; the form rolls back |
| Day 2, afternoon | Component and integration tests, E2E happy path, axe scans, keyboard and VoiceOver pass, screenshots. Simon writes the README | CI green, axe clean, checklist below ticked |

Cut order if we fall behind (none of these are required by the brief): KPI sparklines, anomaly markers, Escape to go up a level, generated chart text summaries beyond one sentence, the video. Never cut: the gate, any required chart, its table alternative, or the E2E happy path.

Commit small and often; the git history is part of what they'll read.

## Risks, open questions and submission checklist

Synthetic data has to tell the fixtures' stories. Citation chips show real dataset values, so the generator must plant the Germany March dip, the APAC vs Europe contrast and the portfolio forecast miss, and fixture text must quote numbers that match. Mitigation: a test that every fixture citation resolves to a dataset value, and fixtures written after the data is generated.

Chart time is the biggest delivery risk: four custom visx charts with keyboard access. Mitigation: one shared chart shell (scales, focus handling, table toggle) built with the first chart on day 1, so the other three reuse it.

Speed versus review: two days of Claude-driven implementation can outrun review. Mitigation: one task per diff, typecheck, lint and tests before each commit, and Simon reviews before the next task starts.

Open questions:

- [x] What's our deadline and total hours? 2 days (decided 28 Oct); Claude Code implements, Simon steers. The schedule needs rewriting for this.
- [x] Do fixtures carry inline citation markers, or only a final citation list? Inline markers, resolved by the final event.
- [x] Is revenue in one currency or local currencies? One reporting currency, USD.
- [x] Country codes: markets keyed by ISO alpha-2 (`DE`, `JP`); one static table in the map module maps them to world-atlas numeric ids, with a test that every market resolves (decided 28 Oct).
- [x] How are products keyed? Discriminated-union `EntityRef`; the product variant carries its `marketId`.
- [x] Fixture content for low confidence: we author the fixtures, so low-confidence answers carry an optional `reason`. The abstention's "nearby question" was cut.
- [x] Free-text questions not in the fixtures: exact match only (normalised for case and whitespace); anything else streams the abstention (decided 28 Oct). Next step for the README: broaden with keyword matching; with a live model behind the route this matching layer wouldn't exist at all.

Submission checklist:

- [ ] Repo public, clean history with meaningful commits
- [ ] Live Vercel link in README
- [ ] README sections a–j, written in our own words
- [ ] Architecture diagram in README
- [ ] Screenshots: exec view, analyst view, chat with citations, low confidence, abstention, alert form
- [ ] 3–5 minute walkthrough video (optional: the brief says "if time permits")
- [ ] CI green, axe clean

