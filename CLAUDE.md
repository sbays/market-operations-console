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
- Pinned on purpose, don't upgrade: TypeScript 6.0 (`typescript-eslint` needs `<6.1`), ESLint 9 (`eslint-plugin-jsx-a11y`
  peers on `≤9`). Node 24 (`.nvmrc`); pnpm version comes from `packageManager` in `package.json`.
- React Compiler is on (`reactCompiler: true`): don't hand-write `useCallback`, `useMemo` or `memo` by default. Use one only where the
  compiler can't help (e.g. per-item values created in a loop or a render prop), and say why in a comment. Vitest does not run the
  compiler, so code must stay correct without it.
- `cacheComponents` is on (Next 16 default): dynamic reads such as nuqs/`useSearchParams` need a Suspense boundary.
- Every dependency must declare React 19 support. Don't force installs with overrides or `--legacy-peer-deps`; flag the library instead.
- Tailwind v4 with CSS-variable tokens, shadcn/ui on Radix
- visx for charts; d3-geo + topojson-client for the choropleth (react-simple-maps dropped 29 Oct, see `docs/PLAN.md`)
- TanStack Query (server state), nuqs (URL state), Zustand (ephemeral UI state only)
- React Hook Form + Zod
- Streaming: `fetch` + `ReadableStream` with our own SSE parser. No Vercel AI SDK, no `EventSource`.
- Vitest + Testing Library + MSW; Playwright + axe-core
- `web-vitals` through Next's `useReportWebVitals` (console reporting, `app/WebVitals.tsx`). Sentry is described in the README, not wired.

Package manager: pnpm. Fonts come from the `geist` package (self-hosted; builds make no network calls).

## Commands

- `pnpm dev`: start dev server
- `pnpm typecheck`: `next typegen && tsc --noEmit` (typegen creates route types such as `LayoutProps`)
- `pnpm lint`: ESLint, including the layer-boundary rules (`import/no-restricted-paths`)
- `pnpm format` / `pnpm format:check`: Prettier with Tailwind class sorting
- `pnpm test`: Vitest (unit + component, jsdom)
- `pnpm test:e2e`: Playwright on Chromium and WebKit, including axe scans (builds and serves on port 3100)
- `pnpm build`
- `pnpm data:generate`: rewrite `src/pack/data.json` and `fixtures.json` (deterministic; never hand-edit them)

CI (`.github/workflows/ci.yml`) runs all of the above on every PR as the `ci` check.

Before saying a task is done, run typecheck, lint and the tests for the code you touched.

## Layout

```
src/
  app/            routes; api/chat (mock SSE), api/alerts (mock store)
  features/       dashboard/ assistant/ alerts/ navigation/
  data/           server-state layer: pack.ts (server-only: loadDataset, loadFixtures), query keys, TanStack Query hooks
  domain/         schema.ts (Zod), selectors.ts (pure derivations), format.ts (Intl)
  state/url.ts    nuqs parsers: path, period, compare, mode
  ui/             shadcn primitives, chart shell, tokens
  pack/           generated data.json + fixtures.json, CONTRACT.md (read only through data/pack.ts)
scripts/          generate-data.ts (seeded; plants the brief's stories), fixture-templates.ts
```

Feature code imports from `data/`, `domain/`, `state/` and `ui/`. Features never import from each other;
shared logic moves down into `data/`, `domain/` or `ui/`. Only `data/` talks to TanStack Query and the network.

## Hard rules

- **No `any`.** Also no `as` casts to escape the type system. Use `unknown` and narrow it.
- **Zod at every boundary.** Types come from `z.infer`. Validate `data.json`, every stream event and every API body. Nothing downstream re-checks shape.
- **One `EntityRef` type** for the URL, charts and citations: a union on `level`; the product variant also carries
  `marketId` (`{ level: 'product', marketId, id }`). Don't create parallel id formats.
- **State has one home.** If someone opening the link should see it, it goes in the URL. Data from the server goes in TanStack Query. Derived values are computed with selectors, never stored. Zustand is only for ephemeral cross-view UI state such as hover (not yet added). The stream buffer is a ref plus `useReducer` in `useChatStream`, batched per animation frame.
- **Views don't talk to each other.** They read and write URL state; everything else is derived.
- **Design tokens only.** No hex values or arbitrary Tailwind values in components. Chart colours come from tokens too.
  Exception: shadcn primitives vendored into `ui/` keep their upstream classes, so updates stay a re-run of the CLI rather than a hand edit.
  Exception: `app/icon.svg` repeats the primary token colours as literals, because an icon can't read CSS variables.
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
- States: idle → connecting → streaming → complete | abstained | stopped | error (`features/assistant/useChatStream.ts`).
  "Stop" keeps the partial answer and labels it as partial; every failure keeps the text that already arrived.
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
- Keep diffs small and focused on one task. Commit messages follow "Commit messages" below.
- Never commit to `main`. One branch and PR per schedule block (`feat/…`, `fix/…`, `docs/…`), rebase-merged after CI passes and Simon approves. Run `/code-review` on the branch before opening the PR.
- Don't add dependencies without saying why. Prefer what's already in the stack.
- If the plan and the code disagree, or a decision isn't covered here, ask. Don't guess.
- **Do not write README prose.** The README must be in the author's own words. You may add command snippets, file paths or the architecture diagram source when asked.

## Commit messages

```
<type>(<scope>): <summary>

Why: <the reason for the change, one or two sentences>

What:
- <change>
- <change>

Tested: <how it was verified, e.g. "selectors.test.ts (15 tests)", or "n/a: docs only">

Assisted-by: Claude Code
```

- **Type:** `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`.
- **Scope:** the area touched, from the layout: `app`, `assistant`, `dashboard`, `alerts`, `navigation`, `data`,
  `domain`, `state`, `ui`, `pack`, `scripts`, `deps`. Use the main one if a commit spans two. Leave the scope out when
  it would only repeat the type (`docs: …`, `ci: …`).
- **Summary:** imperative, lower case, no full stop, at most 72 characters including type and scope.
- **Body:** wrap at 72 characters. `Why` and `Tested` are always present; `What` may be dropped when the
  subject already says it all. Explain why, not how: the diff shows how.
- **Trailer:** every commit Claude writes ends with `Assisted-by: Claude Code`, so AI-assisted work is visible
  in the history.

## Pull request descriptions

Write every PR body with the `mattpocock-skills:pr` skill, save it as a Markdown file in the scratchpad, and hand
Simon `gh pr create … --body-file <path>` (or `gh pr edit <n> --body-file <path>`). Never put the body inline in
`--body "…"`. Structure:

```markdown
## Why
<one or two sentences: the reason for the PR>

## Summary
<the smallest visual that makes the change clear: file tree, call tree, diff sketch or Mermaid diagram>

## Decisions
- <a choice made in this branch, or a deviation from docs/PLAN.md, with its reason>

## Evidence
- **Before:** <failing test, output or screenshot>
  **After:** <passing test, output or screenshot>

## Merge danger
**Door:** <one-way or two-way>. **Blast radius:** <one word>, plus what could break if it is wrong.
```

Leave out `Decisions` when there were none. Keep prose short; let the visuals carry the detail.

## Browser checks

When the browser connection is available, use it to verify UI work against the running app:

- After UI changes: load the page, exercise the feature (drill, select period, stream, stop) and check the console for errors.
- Keyboard pass: tab through the changed area and confirm focus is visible and the order is logical.
- Screenshots for the README only when asked.

Don't use the browser as a substitute for tests. Anything verified by hand that can break later gets a test.
