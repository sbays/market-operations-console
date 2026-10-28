/**
 * Assistant fixtures, written as templates. `{{n}}` becomes the real value of citation n,
 * formatted the way the dashboard formats it, followed by the marker `[n]`. The numbers in
 * fixtures.json therefore always match the dataset; src/data/pack.test.ts re-checks it.
 */
import { formatMetric } from "@/domain/format";
import type {
  Citation,
  Dataset,
  EntityRef,
  Fixture,
  Metric,
  PeriodRef,
} from "@/domain/schema";
import { valueAt } from "@/domain/selectors";

const portfolio: EntityRef = { level: "portfolio" };
const region = (id: string): EntityRef => ({ level: "region", id });
const market = (id: string): EntityRef => ({ level: "market", id });
const product = (marketId: string, id: string): EntityRef => ({
  level: "product",
  marketId,
  id,
});

type Cite = [ref: EntityRef, period: PeriodRef, metric: Metric];

type AnswerTemplate = {
  id: string;
  question: string;
  confidence: number;
  uncertainty?: string;
  /** Citation n is cites[n - 1]. */
  cites: Cite[];
  text: string;
};

function renderAnswer(dataset: Dataset, template: AnswerTemplate): Fixture {
  const citations: Citation[] = template.cites.map(
    ([ref, period, metric], index) => ({ id: index + 1, ref, period, metric }),
  );
  const text = template.text.replace(/\{\{(\d+)\}\}/g, (_match, n: string) => {
    const citation = citations[Number(n) - 1];
    if (!citation) throw new Error(`${template.id}: no citation ${n}`);
    const value = valueAt(dataset, citation.ref, citation.period, citation.metric);
    if (value === undefined) {
      throw new Error(`${template.id}: citation ${n} is not in the data`);
    }
    return `${formatMetric(citation.metric, value)} [${n}]`;
  });
  return {
    id: template.id,
    question: template.question,
    suggested: true,
    response: {
      kind: "answer",
      text,
      confidence: template.confidence,
      citations,
      ...(template.uncertainty ? { uncertainty: template.uncertainty } : {}),
    },
  };
}

const answers: AnswerTemplate[] = [
  {
    id: "at-risk-this-quarter",
    question: "Which markets are at risk this quarter, and why?",
    confidence: 0.86,
    cites: [
      [market("BR"), "2026-Q3", "attainment"],
      [market("JP"), "2026-Q3", "attainment"],
      [market("IN"), "2026-Q3", "attainment"],
      [market("DE"), "2026-Q3", "attainment"],
    ],
    text: [
      "In Q3 2026, four of the twelve markets are below the 98% on-track line.",
      "",
      "- **Brazil** is off-track with attainment of {{1}}. Demand softened after the April devaluation and hasn't recovered.",
      "- **Japan** ({{2}}) and **India** ({{3}}) are at risk. Both are growing, but their forecasts have assumed even faster growth since the FY26 plan.",
      "- **Germany** ({{4}}) is at risk because the Q3 forecast assumed it would win back the Beacon sales lost in March, and that hasn't happened.",
      "",
      "The other eight markets are on track.",
    ].join("\n"),
  },
  {
    id: "germany-march-dip",
    question: "Why did Germany's revenue dip in March 2026?",
    confidence: 0.9,
    cites: [
      [market("DE"), "2026-03", "revenue"],
      [market("DE"), "2026-03", "forecast"],
      [market("DE"), "2026-03", "attainment"],
      [product("DE", "beacon"), "2026-03", "attainment"],
      [market("DE"), "2026-05", "attainment"],
    ],
    text: [
      "Germany's March revenue was {{1}} against a forecast of {{2}}, an attainment of {{3}}.",
      "",
      "Almost all of the gap is **Beacon**, which reached only {{4}} of its forecast after a distributor stock-out held back most shipments. The other four products were close to plan.",
      "",
      "Shipments were partly restored in April, and Germany was back on forecast in May at {{5}}.",
    ].join("\n"),
  },
  {
    id: "apac-vs-europe",
    question: "Compare APAC and Europe on growth and forecast attainment",
    confidence: 0.66,
    uncertainty:
      "APAC forecasts were set more aggressively than Europe's, so attainment isn't like-for-like across the two regions.",
    cites: [
      [region("apac"), "2026-Q3", "growth"],
      [region("eu"), "2026-Q3", "growth"],
      [region("eu"), "2026-Q3", "attainment"],
      [region("apac"), "2026-Q3", "attainment"],
    ],
    text: [
      "In Q3 2026, APAC's year-on-year growth was {{1}}, against {{2}} for Europe.",
      "",
      "Attainment points the other way: Europe delivered {{3}} of forecast and APAC {{4}}. APAC's gap comes from Japan and India, whose forecasts assume even faster growth than they're achieving. Europe's small shortfall is mostly Germany.",
      "",
      "Part of the attainment gap reflects how the forecasts were set rather than how the regions performed.",
    ].join("\n"),
  },
  {
    id: "forecast-miss",
    question: "What's driving the portfolio's forecast miss?",
    confidence: 0.78,
    cites: [
      [portfolio, "2026-Q3", "attainment"],
      [product("US", "cirrus"), "2026-Q3", "attainment"],
      [market("BR"), "2026-Q3", "attainment"],
      [market("JP"), "2026-Q3", "attainment"],
      [market("DE"), "2026-Q3", "attainment"],
    ],
    text: [
      "The portfolio delivered {{1}} of forecast in Q3 2026, its second quarter in a row below the 98% on-track line.",
      "",
      "The biggest single driver is **Cirrus**. The April plan moved growth expectations onto its relaunch, and uptake hasn't followed: in the United States, its largest market, Cirrus reached {{2}} of forecast.",
      "",
      "Market-level misses add to it: Brazil at {{3}}, Japan at {{4}} and Germany at {{5}}.",
    ].join("\n"),
  },
  {
    id: "cirrus-by-market",
    question: "Is Cirrus underperforming everywhere or just in some markets?",
    confidence: 0.42,
    uncertainty:
      "Cirrus has only six months of data under the new plan, and product-level monthly figures are noisy.",
    cites: [
      [product("US", "cirrus"), "2026-Q3", "attainment"],
      [product("JP", "cirrus"), "2026-Q3", "attainment"],
      [product("BR", "cirrus"), "2026-Q3", "attainment"],
    ],
    text: [
      "Cirrus has been below forecast in every market since April, but by different amounts. In Q3 2026 it reached {{1}} of forecast in the United States, {{2}} in Japan and {{3}} in Brazil.",
      "",
      "The spread may be noise rather than a real difference between markets: six months under the new plan isn't much to go on.",
    ].join("\n"),
  },
  {
    id: "portfolio-review",
    question: "Give me a full portfolio review for Q3 2026",
    confidence: 0.8,
    cites: [
      [portfolio, "2026-Q3", "revenue"],
      [portfolio, "2026-Q3", "growth"],
      [portfolio, "2026-Q3", "attainment"],
      [region("na"), "2026-Q3", "growth"],
      [region("na"), "2026-Q3", "attainment"],
      [region("eu"), "2026-Q3", "growth"],
      [region("eu"), "2026-Q3", "attainment"],
      [region("apac"), "2026-Q3", "growth"],
      [region("apac"), "2026-Q3", "attainment"],
      [region("latam"), "2026-Q3", "growth"],
      [region("latam"), "2026-Q3", "attainment"],
      [market("BR"), "2026-Q3", "attainment"],
      [market("JP"), "2026-Q3", "attainment"],
      [market("IN"), "2026-Q3", "attainment"],
      [market("DE"), "2026-Q3", "attainment"],
      [product("US", "cirrus"), "2026-Q3", "attainment"],
    ],
    text: [
      "## Summary",
      "",
      "The portfolio earned {{1}} in Q3 2026, a change of {{2}} on the same quarter last year, but delivered only {{3}} of forecast. That keeps it at risk for a second quarter running.",
      "",
      "## Regions",
      "",
      "- **North America** changed by {{4}} year on year with attainment of {{5}}, comfortably on track.",
      "- **Europe** changed by {{6}} with attainment of {{7}}. Germany is the only European market at risk.",
      "- **Asia Pacific** had the fastest growth at {{8}}, but reached only {{9}} of forecast.",
      "- **Latin America** changed by {{10}} with attainment of {{11}}, held back by Brazil.",
      "",
      "## Markets to watch",
      "",
      "- **Brazil** is off-track at {{12}}. Demand softened after the April devaluation and hasn't recovered.",
      "- **Japan** ({{13}}) and **India** ({{14}}) are at risk: their forecasts assume faster growth than they're delivering, strong as that growth is.",
      "- **Germany** ({{15}}) recovered from the March stock-out, but the Q3 forecast also assumed it would win back the lost sales.",
      "",
      "## Products",
      "",
      "Cirrus is the largest single gap. Since the April plan moved growth expectations onto its relaunch, it has reached {{16}} of forecast in the United States, and the pattern is similar in other markets.",
      "",
      "## What to check next",
      "",
      "- Cirrus attainment market by market, to see whether any market is adopting the relaunch faster than the rest.",
      "- Whether Japan's and India's forecasts should be reset to the growth they're actually achieving.",
      "- Brazil's recovery plan, since it is the only off-track market.",
    ].join("\n"),
  },
];

export function renderFixtures(dataset: Dataset): Fixture[] {
  return [
    ...answers.map((template) => renderAnswer(dataset, template)),
    {
      id: "revenue-next-quarter",
      question: "What will revenue be in Q1 2027?",
      suggested: true,
      response: {
        kind: "abstention",
        reason:
          "The data ends in September 2026 and has no forecasts beyond it, so any figure for Q1 2027 would be invented.",
      },
    },
    {
      id: "germany-product-trend",
      question: "Show me how each product has trended in Germany",
      suggested: true,
      response: {
        kind: "error",
        text: "Germany's five products have followed different paths since October 2024. Atlas has grown steadily, while Beacon",
        message: "The assistant stopped responding before the answer was complete.",
      },
    },
  ];
}
