# CLAUDE.md

Market Operations console: a take-home front-end assignment. Two connected surfaces over one dataset:
a streaming AI assistant (faked backend) and an analytical dashboard with drill-down and coordinated views.

**The full plan is in `docs/PLAN.md`. Read the section relevant to your task before starting.**
This file holds the rules that apply to every task.

## What is being graded

Reviewers judge how it's built as much as what's built. In priority order:

1. Trust surfaces in the assistant: citations, confidence, AI-vs-authoritative distinction, abstention.
2. Code quality: strict types end to end, clean component boundaries, readable code.
3. Coordinated views with shareable URL state.
4. Accessibility: every chart has an accessible alternative.
5. Design taste: one coherent token-based system.
6. AI-assisted workflow: the brief evaluates how AI tools are used. This file and `docs/PLAN.md` are committed as evidence; keep them current when decisions change.

A small, working, well-engineered build beats a large, broken one. Do not add features outside the current task.

## Stack (decided; don't swap without asking)

- Next.js 16 App Router, React 19, TypeScript strict (use current stable releases)
- Every dependency must declare React 19 support. Don't force installs with overrides or `--legacy-peer-deps`; flag the library instead.
- Tailwind v4 with CSS-variable tokens, shadcn/ui on Radix
- visx for charts; react-simple-maps + d3-geo for the choropleth
- TanStack Query (server state), nuqs (URL state), Zustand (ephemeral UI state only)
- React Hook Form + Zod
- Streaming: `fetch` + `ReadableStream` with our own SSE parser. No Vercel AI SDK, no `EventSource`.
- Vitest + Testing Library + MSW; Playwright + axe-core
- `web-vitals` (console reporting). Sentry is described in the README, not wired.

Package manager: pnpm.

## Commands

<!-- Confirm these once the project is scaffolded -->
- `pnpm dev`: start dev server
- `pnpm typecheck`: `tsc --noEmit`
- `pnpm lint`
- `pnpm test`: Vitest (unit + component)
- `pnpm test:e2e`: Playwright, including axe scans
- `pnpm build`

Before saying a task is done, run typecheck, lint and the tests for the code you touched.

## Layout

```
src/
  app/            routes; api/chat (mock SSE), api/alerts (mock store)
  features/       dashboard/ assistant/ alerts/ navigation/
  data/           server-state layer: query keys, fetchers, TanStack Query hooks
  domain/         schema.ts (Zod), selectors.ts (pure derivations), format.ts (Intl)
  state/url.ts    nuqs parsers: path, period, compare, mode
  ui/             shadcn primitives, chart shell, tokens
```

Feature code imports from `data/`, `domain/`, `state/` and `ui/`. Features never import from each other;
shared logic moves down into `data/`, `domain/` or `ui/`. Only `data/` talks to TanStack Query and the network.

## Hard rules

- **No `any`.** Also no `as` casts to escape the type system. Use `unknown` and narrow it.
- **Zod at every boundary.** Types come from `z.infer`. Validate `data.json`, every stream event and every API body. Nothing downstream re-checks shape.
- **One `EntityRef` type** (`{ level, id }`) for the URL, charts and citations. Don't create parallel id formats.
- **State has one home.** If someone opening the link should see it, it goes in the URL. Data from the server goes in TanStack Query. Derived values are computed with selectors, never stored. Zustand is only for hover, panel open and the stream buffer.
- **Views don't talk to each other.** They read and write URL state; everything else is derived.
- **Design tokens only.** No hex values or arbitrary Tailwind values in components. Chart colours come from tokens too.
- **Never colour alone.** Status always has an icon and a text label.
- **Every chart** gets a "View as table" alternative, `role="img"` with a text summary, keyboard-reachable data points, and support for `prefers-reduced-motion`.
- **Model output rendering:** use react-markdown with raw HTML disabled. Never `dangerouslySetInnerHTML`.
- **Formatting** goes through `domain/format.ts` only. No inline `toFixed` or `toLocaleString`.
- **The mock backend stays a mock.** Only extend `api/chat` to pass dashboard context or to fuzzy-match fixtures. No real LLM calls, no database, no auth.

## Starter pack

The assignment's pack was not available, so we author our own equivalent (decided 28 Oct): `data.json` from a
seeded generator script, `fixtures.json`, `CONTRACT.md` and the mock `/api/chat` route. It follows the brief's described
contract; `docs/PLAN.md` (Data layer, Assistant surface) holds the decided shapes. Once written, treat these files as
the source of truth. All data goes through `loadDataset()` and the stream hook's interface, so a real pack would
replace one module. Fixture text must quote numbers that match the dataset; a test enforces it.

## Assistant specifics

- Batch token updates per animation frame; don't re-render per token.
- States: idle → connecting → streaming → complete | stopped | error. "Stop" keeps the partial answer and labels it as partial.
- A citation chip's tooltip shows the real value from the dataset, not the model's number. Clicking it drills the dashboard.
- Confidence is a labelled badge (High / Medium / Low) with icon and text. Abstention is its own card state, not an error.
- AI content gets its own surface style and label. Never style AI-stated numbers as source data.

## Testing

- Unit-test every selector, formatter, parser and schema. These are what the numbers depend on.
- Component tests cover behaviour (states, interactions, URL changes), not markup snapshots.
- Use MSW for network calls in tests. Never hit the real route from component tests.
- No visual-regression or snapshot tests.

## Working style

- Start non-trivial tasks in plan mode. Wait for the plan to be approved before writing code.
- Keep diffs small and focused on one task. Use conventional commits (`feat:`, `fix:`, `test:`, `chore:`).
- Never commit to `main`. One branch and PR per schedule block (`feat/…`, `fix/…`, `docs/…`), rebase-merged after CI passes and Simon approves. Run `/code-review` on the branch before opening the PR.
- Don't add dependencies without saying why. Prefer what's already in the stack.
- If the plan and the code disagree, or a decision isn't covered here, ask. Don't guess.
- **Do not write README prose.** The README must be in the author's own words. You may add command snippets, file paths or the architecture diagram source when asked.

## Browser checks

When the browser connection is available, use it to verify UI work against the running app:

- After UI changes: load the page, exercise the feature (drill, select period, stream, stop) and check the console for errors.
- Keyboard pass: tab through the changed area and confirm focus is visible and the order is logical.
- Screenshots for the README only when asked.

Don't use the browser as a substitute for tests. Anything verified by hand that can break later gets a test.
