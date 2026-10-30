/**
 * Alert rules: what the configurator collects, and the rules that make a threshold meaningful.
 * Pure. The schema cannot see the dataset, so normaliseScope checks scope paths against it
 * on the server, where the form's options can't be trusted.
 */
import { z } from "zod";
import { formatMetric, formatMetricName, formatTypedPercent } from "./format";
import {
  EntityPathSchema,
  type Dataset,
  type EntityPath,
  type EntityRef,
  type PeriodRef,
} from "./schema";
import {
  coversPath,
  displayedRatio,
  entityLabel,
  isAncestorPath,
  pathOf,
  refFromPath,
  valueAt,
} from "./selectors";

export const AlertMetricSchema = z.enum(["growth", "attainment"]);
export type AlertMetric = z.infer<typeof AlertMetricSchema>;

export const AlertOperatorSchema = z.enum(["below", "above"]);
export type AlertOperator = z.infer<typeof AlertOperatorSchema>;

/**
 * Valid thresholds per metric, as percentages the user types (95 means 95%). Bounds are
 * inclusive. Growth can fall by at most 100% and is capped at 1000%; attainment is 0 to 200%.
 */
export const THRESHOLD_RANGE: Record<
  AlertMetric,
  { min: number; max: number }
> = {
  growth: { min: -100, max: 1000 },
  attainment: { min: 0, max: 200 },
};

const METRIC_LABEL: Record<AlertMetric, string> = {
  growth: "Growth",
  attainment: "Attainment",
};

const RuleFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the rule a name.")
    .max(60, "Keep the rule name to 60 characters or fewer."),
  scope: z
    .array(EntityPathSchema.min(1))
    .min(1, "Pick at least one region or market."),
  metric: AlertMetricSchema,
  operator: AlertOperatorSchema,
  threshold: z.number({ error: "Enter the threshold as a number." }),
});

/** "-100% to 1,000%": the valid thresholds for a metric, as the form's hint and errors say them. */
export function thresholdRangeText(metric: AlertMetric): string {
  const { min, max } = THRESHOLD_RANGE[metric];
  return `${formatTypedPercent(min)} to ${formatTypedPercent(max)}`;
}

/** The cross-field rule: the threshold's range depends on the metric. */
function checkThresholdRange(
  rule: { metric: AlertMetric; threshold: number },
  ctx: z.RefinementCtx,
) {
  const { min, max } = THRESHOLD_RANGE[rule.metric];
  if (rule.threshold < min || rule.threshold > max) {
    ctx.addIssue({
      code: "custom",
      path: ["threshold"],
      message: `${METRIC_LABEL[rule.metric]} thresholds run from ${thresholdRangeText(rule.metric)}.`,
    });
  }
}

export const AlertRuleInputSchema =
  RuleFieldsSchema.superRefine(checkThresholdRange);
export type AlertRuleInput = z.infer<typeof AlertRuleInputSchema>;

export const AlertRuleSchema = RuleFieldsSchema.extend({
  id: z.string().min(1),
}).superRefine(checkThresholdRange);
export type AlertRule = z.infer<typeof AlertRuleSchema>;

export type ScopeCheck =
  { ok: true; scope: EntityPath[] } | { ok: false; invalid: EntityPath[] };

/**
 * The scope as a rule stores it, checked against the data. Only regions and markets the data
 * contains are valid scope. Each path is kept once, and a market is dropped when its region is
 * also ticked, so a rule never watches a market twice.
 */
export function normaliseScope(
  dataset: Dataset,
  scope: EntityPath[],
): ScopeCheck {
  const invalid = scope.filter((path) => {
    const ref = refFromPath(dataset, path);
    return ref?.level !== "region" && ref?.level !== "market";
  });
  if (invalid.length > 0) return { ok: false, invalid };
  const unique = [...new Set(scope)];
  return {
    ok: true,
    scope: unique.filter(
      (path) => !unique.some((other) => isAncestorPath(other, path)),
    ),
  };
}

/**
 * The markets a rule flags over a period, in dataset order: every market in its scope (a
 * region scope covers each of its markets) whose metric, as displayed, is strictly past the
 * threshold. A market with no value for the period is never flagged.
 */
export function alertMatches(
  dataset: Dataset,
  rule: Pick<AlertRule, "scope" | "metric" | "operator" | "threshold">,
  period: PeriodRef,
): EntityRef[] {
  // Rounded like the value: 99.9 / 100 isn't exactly 0.999 in binary floating point.
  const limit = displayedRatio(rule.threshold / 100);
  return dataset.markets.flatMap((market) => {
    const ref: EntityRef = { level: "market", id: market.id };
    const path = pathOf(dataset, ref);
    const inScope =
      path !== undefined &&
      rule.scope.some((scoped) => coversPath(scoped, path));
    if (!inScope) return [];
    const raw = valueAt(dataset, ref, period, rule.metric);
    if (raw === undefined) return [];
    const value = displayedRatio(raw);
    const crossed = rule.operator === "below" ? value < limit : value > limit;
    return crossed ? [ref] : [];
  });
}

/**
 * One line for the rule list: "Forecast attainment below 95.0% in Germany, France". The
 * threshold is a typed percentage (95 means 95%), so it is divided by 100 before formatting.
 * Scope paths the dataset no longer contains are left out rather than shown as raw ids.
 */
export function describeAlert(
  rule: Pick<AlertRule, "scope" | "metric" | "operator" | "threshold">,
  dataset: Dataset,
): string {
  const scope = rule.scope
    .map((path) => refFromPath(dataset, path))
    .flatMap((ref) => (ref ? [entityLabel(dataset, ref)] : []))
    .join(", ");
  const threshold = formatMetric(rule.metric, rule.threshold / 100);
  return `${formatMetricName(rule.metric)} ${rule.operator} ${threshold} in ${scope}`;
}
