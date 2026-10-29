"use client";

/**
 * Alert rules as server state: the list, and a save that shows the new rule at once and rolls
 * it back when the server refuses. Only this module talks to /api/alerts.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseAsInteger, useQueryState } from "nuqs";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertRuleSchema,
  type AlertRule,
  type AlertRuleInput,
} from "@/domain/alert";

/** A rule in the list. Rows still being saved carry `pending` and a temporary id. */
export type AlertListItem = AlertRule & { pending?: true };

const AlertsResponseSchema = z.object({ rules: z.array(AlertRuleSchema) });

async function fetchAlerts(): Promise<AlertListItem[]> {
  const response = await fetch("/api/alerts");
  if (!response.ok) {
    throw new Error(`The alert rules returned ${response.status}`);
  }
  return AlertsResponseSchema.parse(await response.json()).rules;
}

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: fetchAlerts,
});

/** The saved rules. Not suspense: nothing is hydrated, so the list shows its own loading state. */
export function useAlerts() {
  return useQuery(alertsQuery);
}

async function postAlert(
  input: AlertRuleInput,
  fail: boolean,
): Promise<AlertRule> {
  const response = await fetch(`/api/alerts${fail ? "?fail=1" : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Saving the alert rule returned ${response.status}`);
  }
  return AlertRuleSchema.parse(await response.json());
}

/**
 * Saves a rule. The page's `?fail=1` is forwarded so the mock refuses the save, which is how
 * the rollback is reached on purpose.
 */
export function useCreateAlert() {
  const queryClient = useQueryClient();
  const [fail] = useQueryState("fail", parseAsInteger);

  const mutation = useMutation({
    mutationFn: (input: AlertRuleInput) => postAlert(input, fail === 1),
    onMutate: async (input) => {
      // An in-flight refetch would otherwise overwrite the optimistic row.
      await queryClient.cancelQueries({ queryKey: alertsQuery.queryKey });
      const previous = queryClient.getQueryData(alertsQuery.queryKey);
      const pending: AlertListItem = {
        ...input,
        id: `pending-${crypto.randomUUID()}`,
        pending: true,
      };
      queryClient.setQueryData(alertsQuery.queryKey, [
        ...(previous ?? []),
        pending,
      ]);
      return { previous };
    },
    onError: (_error, input, context) => {
      queryClient.setQueryData(alertsQuery.queryKey, context?.previous);
      toast.error("Couldn't save the alert rule.", {
        action: {
          label: "Retry",
          onClick: () => mutation.mutate(input),
        },
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: alertsQuery.queryKey }),
  });

  return mutation;
}
