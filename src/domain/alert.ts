/**
 * Alert rules: what the configurator collects, and the rules that make a threshold meaningful.
 * Pure: the schema cannot see the dataset, so scope paths are checked by the form's options.
 */
import { z } from "zod";
import { formatMetric, formatMetricName, formatTypedPercent } from "./format";
import type { Dataset } from "./schema";
import { entityLabel, refFromPath } from "./selectors";

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
    .array(z.string().min(1))
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
