/**
 * What the dashboard derives for one period and one entity, printed as text. It calls the app's
 * own selectors and formatters, so an answer to "why isn't LATAM a top risk?" comes from the
 * code that draws the dashboard, never from a re-derivation that could drift from it.
 *
 * Usage: `pnpm facts [period] [path]`. Period is a month (2026-05) or quarter (2026-Q2) and
 * defaults to the dashboard's default; path is the URL's drill path (latam, eu.de).
 */
import { loadDataset } from "@/data/pack";
import {
  formatMetricOrMissing,
  formatPeriod,
  formatStatus,
} from "@/domain/format";
import { isMonth, isQuarter, type PeriodRef } from "@/domain/period";
import type { Dataset, EntityRef } from "@/domain/schema";
import {
  childrenOf,
  entityLabel,
  expandPeriod,
  refFromPath,
  selectionPeriod,
  statusAt,
  topRisks,
  valueAt,
} from "@/domain/selectors";

/** How many risks the dashboard's Top risks list shows (RiskMovers' LIST_LENGTH). */
export const SHOWN_RISKS = 3;

const COLUMNS = ["attainment", "growth", "share"] as const;

export type FactsResult =
  { ok: true; text: string } | { ok: false; error: string };

type Args = { period: PeriodRef; ref: EntityRef };

function parseArgs(
  dataset: Dataset,
  args: readonly string[],
): Args | { error: string } {
  let period: PeriodRef | null = null;
  let path = "";
  for (const arg of args) {
    if (isMonth(arg) || isQuarter(arg)) period = arg;
    else path = arg;
  }
  if (period !== null && expandPeriod(dataset, period).length === 0) {
    return { error: `No data for period ${period}.` };
  }
  const ref = refFromPath(dataset, path);
  if (!ref) return { error: `No entity at path "${path}".` };
  return { period: selectionPeriod(dataset, period), ref };
}

function row(dataset: Dataset, ref: EntityRef, period: PeriodRef): string[] {
  const status = statusAt(dataset, ref, period);
  return [
    entityLabel(dataset, ref),
    ...COLUMNS.map((metric) =>
      formatMetricOrMissing(metric, valueAt(dataset, ref, period, metric)),
    ),
    status ? formatStatus(status) : "No data",
  ];
}

function table(rows: readonly string[][]): string {
  const widths: number[] = [];
  for (const cells of rows) {
    cells.forEach((cell, i) => {
      widths[i] = Math.max(widths[i] ?? 0, cell.length);
    });
  }
  return rows
    .map((cells) =>
      cells
        .map((cell, i) => cell.padEnd(widths[i] ?? 0))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

/** The report for `pnpm facts`, or the reason the arguments name nothing in the data. */
export function factsReport(
  dataset: Dataset,
  args: readonly string[],
): FactsResult {
  const parsed = parseArgs(dataset, args);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const { period, ref } = parsed;

  const children = childrenOf(dataset, ref);
  const header = ["Entity", "Attainment", "Growth", "Share", "Status"];
  const rows = [
    header,
    row(dataset, ref, period),
    ...children.map((child) => {
      const [name, ...rest] = row(dataset, child, period);
      return [`  ${name}`, ...rest];
    }),
  ];

  const lines = [
    `${entityLabel(dataset, ref)}, ${formatPeriod(period)} (${period})`,
    "",
    table(rows),
  ];

  if (children.length > 0) {
    const risks = topRisks(dataset, ref, period, children.length);
    lines.push("", `Top risks (the dashboard shows the first ${SHOWN_RISKS}):`);
    if (risks.length === 0) lines.push("  none");
    risks.forEach((risk, i) => {
      const marker = i < SHOWN_RISKS ? "*" : " ";
      lines.push(
        `${marker} ${entityLabel(dataset, risk.ref)}: ${formatStatus(risk.status)}. ${risk.reason}`,
      );
    });
  }

  return { ok: true, text: lines.join("\n") };
}

/** The entry point scripts/facts-cli.mjs calls, with the validated pack. */
export function run(args: readonly string[]): FactsResult {
  return factsReport(loadDataset(), args);
}
