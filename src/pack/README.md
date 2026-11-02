# Front-End Assignment: Starter Pack

This pack contains the data and a fake backend for the Market Operations console assignment, so you can spend your time on the front-end rather than on plumbing.

## What's inside

| File | What it is |
| --- | --- |
| `data.json` | The canonical market operations dataset: regions, markets (with ISO country codes and latest-period KPIs), products, and a 24-month series. Identical for every candidate. |
| `fixtures.json` | Canned question to answer pairs for the assistant, including a low-confidence answer, an abstain, an error, and a long response. Citations point at real ids in `data.json`. |
| `reference/chat-route.ts` | A ~40-line Next.js App Router handler that streams a fixture as Server-Sent Events. |
| `CONTRACT.md` | The streaming event contract and the full shape of `data.json` and `fixtures.json`. Read this first. |

## Using it

1. Read `CONTRACT.md`.
2. Drop `reference/chat-route.ts` in at `app/api/chat/route.ts` and point its import at your copy of `fixtures.json` (or write your own endpoint that follows the same contract).
3. Load `data.json` for the dashboard and resolve citation ids against it.

You are free to use this as-is, extend it, or replace it with your own equivalent. Do not turn it into a real backend, and do not wire up an actual LLM; neither earns extra credit. The numbers are synthetic but internally consistent, with a deliberate story baked in (see the notes in `CONTRACT.md`).
