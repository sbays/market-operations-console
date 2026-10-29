/**
 * Seeds the client's query cache with the validated dataset, so client components read it
 * through useDataset without a request.
 */
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import type { ReactNode } from "react";
import { loadDataset } from "./pack";
import { datasetQuery } from "./queries";

export function DatasetHydration({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(datasetQuery.queryKey, loadDataset());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {children}
    </HydrationBoundary>
  );
}
