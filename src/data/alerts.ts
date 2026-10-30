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

/**
 * Fetched once per page. The mock keeps rules in one server instance's memory, so a refetch
 * could reach an instance that never saw a save; saves update the cache directly instead
 * (except one made before the first load landed, which needs that load).
 */
export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: fetchAlerts,
  staleTime: Infinity,
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
 * Saves a rule. With `fail`, the request asks the mock to refuse the save, which is how the
 * rollback is reached on purpose (the page's `?fail=1`, read in state/url).
 */
export function useCreateAlert({ fail }: { fail: boolean }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: AlertRuleInput) => postAlert(input, fail),
    onMutate: async (input) => {
      const listLoaded =
        queryClient.getQueryData(alertsQuery.queryKey) !== undefined;
      // An in-flight refetch would otherwise overwrite the optimistic row.
      await queryClient.cancelQueries({ queryKey: alertsQuery.queryKey });
      const pending: AlertListItem = {
        ...input,
        id: `pending-${crypto.randomUUID()}`,
        pending: true,
      };
      queryClient.setQueryData(alertsQuery.queryKey, (rules) => [
        ...(rules ?? []),
        pending,
      ]);
      return { pendingId: pending.id, listLoaded };
    },
    onError: (_error, input, context) => {
      // Only this save's row goes: restoring a snapshot would also drop rows that other saves
      // added after it and that are still in progress.
      queryClient.setQueryData(alertsQuery.queryKey, (rules) =>
        rules?.filter((rule) => rule.id !== context?.pendingId),
      );
      toast.error("Couldn't save the alert rule.", {
        action: {
          label: "Retry",
          onClick: () => mutation.mutate(input),
        },
      });
    },
    onSuccess: (rule, _input, context) => {
      // The saved rule takes the pending row's place, keeping the list's order.
      queryClient.setQueryData(alertsQuery.queryKey, (rules) =>
        rules?.map((row) => (row.id === context.pendingId ? rule : row)),
      );
      toast.success(`Saved alert rule “${rule.name}”.`);
    },
    onSettled: (_rule, _error, _input, context) => {
      // Saved before the first load finished: that load was cancelled above, so the cache
      // holds only this save's row. Fetch once to bring back the rules saved earlier.
      if (context?.listLoaded !== false) return;
      return queryClient.invalidateQueries({ queryKey: alertsQuery.queryKey });
    },
  });

  return mutation;
}
