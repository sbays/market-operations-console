"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useId, useRef, useState, type Ref } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useCreateAlert } from "@/data/alerts";
import { useDataset } from "@/data/useDataset";
import {
  AlertMetricSchema,
  AlertOperatorSchema,
  AlertRuleInputSchema,
  thresholdRangeText,
  type AlertOperator,
  type AlertRuleInput,
} from "@/domain/alert";
import { formatMetricName } from "@/domain/format";
import type { Dataset, EntityRef } from "@/domain/schema";
import { pathOf } from "@/domain/selectors";
import { useFailSaves, useSelection } from "@/state/url";
import { Button } from "@/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/ui/dialog";

const OPERATOR_LABEL: Record<AlertOperator, string> = {
  below: "Below",
  above: "Above",
};

/** The order errors are listed in the summary: the order of the form. */
const FIELD_ORDER = [
  "name",
  "scope",
  "metric",
  "operator",
  "threshold",
] as const satisfies readonly (keyof AlertRuleInput)[];
type FieldName = (typeof FIELD_ORDER)[number];

const FIELD_LABEL: Record<FieldName, string> = {
  name: "Rule name",
  scope: "Scope",
  metric: "Metric",
  operator: "Operator",
  threshold: "Threshold",
};

/** The scope a new rule starts with: the selection's region or market, nothing at the portfolio. */
function defaultScope(dataset: Dataset, ref: EntityRef): string[] {
  // A product is scoped to its market, since the rule watches markets.
  const scopeRef: EntityRef =
    ref.level === "product" ? { level: "market", id: ref.marketId } : ref;
  const path = scopeRef.level === "portfolio" ? "" : pathOf(dataset, scopeRef);
  return path ? [path] : [];
}

/** The message from a react-hook-form error, if there is one. */
function messageOf(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return undefined;
}

/** The space-separated id list for aria-describedby, or undefined when there is none. */
function describedBy(...ids: (string | undefined)[]): string | undefined {
  return ids.filter(Boolean).join(" ") || undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

const inputClass =
  "rounded-md border border-input bg-background px-3 py-2 text-sm";

/** One tickable entry: a region or a market. The path is what the rule stores. */
function ScopeCheckbox({
  path,
  label,
  checked,
  onToggle,
  inputRef,
}: {
  path: string;
  label: string;
  checked: boolean;
  onToggle: (path: string, checked: boolean) => void;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <input
        id={id}
        ref={inputRef}
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        onChange={(event) => onToggle(path, event.target.checked)}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/** Regions, each with its markets nested under it. Every entry is a separate checkbox. */
function ScopePicker({
  dataset,
  selected,
  onChange,
  error,
  errorId,
  firstRef,
}: {
  dataset: Dataset;
  selected: string[];
  onChange: (scope: string[]) => void;
  error?: string;
  errorId: string;
  firstRef: Ref<HTMLInputElement>;
}) {
  const toggle = (path: string, checked: boolean) =>
    onChange(
      checked
        ? [...selected, path]
        : selected.filter((picked) => picked !== path),
    );

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-medium">Scope</legend>
      <ul className="flex flex-col gap-2">
        {dataset.regions.map((region, index) => (
          <li key={region.id} className="flex flex-col gap-1.5">
            <ScopeCheckbox
              path={region.id}
              label={region.name}
              checked={selected.includes(region.id)}
              onToggle={toggle}
              inputRef={index === 0 ? firstRef : undefined}
            />
            <ul className="flex flex-col gap-1.5 pl-6">
              {dataset.markets
                .filter((market) => market.regionId === region.id)
                .map((market) => {
                  const path = `${region.id}.${market.id}`;
                  return (
                    <li key={market.id}>
                      <ScopeCheckbox
                        path={path}
                        label={market.name}
                        checked={selected.includes(path)}
                        onToggle={toggle}
                      />
                    </li>
                  );
                })}
            </ul>
          </li>
        ))}
      </ul>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}

function AlertForm({ onSaved }: { onSaved: () => void }) {
  const id = useId();
  const dataset = useDataset();
  const { ref } = useSelection();
  const createAlert = useCreateAlert({ fail: useFailSaves() });

  const form = useForm<AlertRuleInput>({
    resolver: zodResolver(AlertRuleInputSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      scope: defaultScope(dataset, ref),
      metric: "growth",
      operator: "below",
      // NaN is what an empty number input reads as; the schema turns it into a message.
      threshold: Number.NaN,
    },
  });

  const { errors } = form.formState;
  // useWatch rather than watch(): watch() is the one RHF API the React Compiler will not memoize.
  const metric = useWatch({ control: form.control, name: "metric" });

  const issues = FIELD_ORDER.flatMap((field) => {
    const message = messageOf(errors[field]);
    return message ? [{ field, message }] : [];
  });

  // Focus moves to the summary after a failed submit, once it has rendered. Only a submit
  // asks for it, so fixing a field afterwards never pulls focus away from the typing.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [summaryRequest, setSummaryRequest] = useState(0);
  useEffect(() => {
    if (summaryRequest > 0) summaryRef.current?.focus();
  }, [summaryRequest]);

  const scopeFirstRef = useRef<HTMLInputElement>(null);
  function focusField(field: FieldName) {
    if (field === "scope") scopeFirstRef.current?.focus();
    else form.setFocus(field);
  }

  function onValid(values: AlertRuleInput) {
    createAlert.mutate(values);
    onSaved();
  }

  const fieldId = (field: string) => `${id}-${field}`;
  const errorId = (field: string) => `${id}-${field}-error`;

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(onValid, () =>
        setSummaryRequest((count) => count + 1),
      )}
      className="flex flex-col gap-5"
    >
      {issues.length > 0 ? (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm"
        >
          <h3 className="font-semibold">Fix these before saving</h3>
          <ul className="mt-2 list-disc pl-5">
            {issues.map(({ field, message }) => (
              <li key={field}>
                <button
                  type="button"
                  className="text-left underline underline-offset-4"
                  onClick={() => focusField(field)}
                >
                  {message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId("name")} className="text-sm font-medium">
          {FIELD_LABEL.name}
        </label>
        <input
          id={fieldId("name")}
          type="text"
          autoComplete="off"
          className={inputClass}
          aria-invalid={messageOf(errors.name) ? true : undefined}
          aria-describedby={describedBy(
            messageOf(errors.name) ? errorId("name") : undefined,
          )}
          {...form.register("name")}
        />
        <FieldError id={errorId("name")} message={messageOf(errors.name)} />
      </div>

      <Controller
        control={form.control}
        name="scope"
        render={({ field }) => (
          <ScopePicker
            dataset={dataset}
            selected={field.value}
            onChange={field.onChange}
            error={messageOf(errors.scope)}
            errorId={errorId("scope")}
            firstRef={scopeFirstRef}
          />
        )}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{FIELD_LABEL.metric}</legend>
        {AlertMetricSchema.options.map((option) => (
          <div key={option} className="flex items-center gap-2 text-sm">
            <input
              id={fieldId(`metric-${option}`)}
              type="radio"
              value={option}
              className="size-4 accent-primary"
              {...form.register("metric")}
            />
            <label htmlFor={fieldId(`metric-${option}`)}>
              {formatMetricName(option)}
            </label>
          </div>
        ))}
      </fieldset>

      <div className="grid grid-cols-2 items-start gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("operator")} className="text-sm font-medium">
            {FIELD_LABEL.operator}
          </label>
          <select
            id={fieldId("operator")}
            className={inputClass}
            {...form.register("operator")}
          >
            {AlertOperatorSchema.options.map((option) => (
              <option key={option} value={option}>
                {OPERATOR_LABEL[option]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("threshold")} className="text-sm font-medium">
            {FIELD_LABEL.threshold}
          </label>
          <div className="flex items-center gap-2">
            <input
              id={fieldId("threshold")}
              type="number"
              step="any"
              inputMode="decimal"
              className={`${inputClass} w-full`}
              aria-invalid={messageOf(errors.threshold) ? true : undefined}
              aria-describedby={describedBy(
                fieldId("threshold-hint"),
                messageOf(errors.threshold) ? errorId("threshold") : undefined,
              )}
              {...form.register("threshold", { valueAsNumber: true })}
            />
            <span aria-hidden="true" className="text-sm text-muted-foreground">
              %
            </span>
          </div>
          <p
            id={fieldId("threshold-hint")}
            className="text-xs text-muted-foreground"
          >
            Valid range for {formatMetricName(metric).toLowerCase()}:{" "}
            {thresholdRangeText(metric)}.
          </p>
          <FieldError
            id={errorId("threshold")}
            message={messageOf(errors.threshold)}
          />
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit">Save rule</Button>
      </DialogFooter>
    </form>
  );
}

/** The "New alert" button and the rule builder it opens. */
export function AlertDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button">New alert</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New alert rule</DialogTitle>
          <DialogDescription>
            Flag the markets in scope when a metric crosses a threshold.
          </DialogDescription>
        </DialogHeader>
        <AlertForm onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
