/**
 * Seeds the client's query cache with the validated dataset, so client components read it
 * through useDataset without a request.
 */
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
  type DehydratedState,
} from "@tanstack/react-query";
import { cacheLife } from "next/cache";
import type { ReactNode } from "react";
import { loadDataset } from "./pack";
import { datasetQuery } from "./queries";

/**
 * Cached so the static page can prerender: the dataset never changes between builds, and
 * dehydrate() timestamps with Date.now(), which Next only allows inside a cache scope.
 */
export async function dehydrateDataset(): Promise<DehydratedState> {
  "use cache";
  cacheLife("max");
  const queryClient = new QueryClient();
  queryClient.setQueryData(datasetQuery.queryKey, loadDataset());
  return dehydrate(queryClient);
}

export function DatasetHydration({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
