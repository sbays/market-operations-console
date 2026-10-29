/** Query definitions shared by the server (which seeds the cache) and the client (which reads it). */
import { queryOptions } from "@tanstack/react-query";
import type { Dataset } from "@/domain/schema";

/**
 * The dataset is static: the server validates it once and seeds the cache, so the client
 * never fetches it. If this queryFn ever runs, the hydration was skipped.
 */
export const datasetQuery = queryOptions({
  queryKey: ["dataset"],
  queryFn: (): Promise<Dataset> =>
    Promise.reject(new Error("The dataset must be hydrated from the server")),
  staleTime: Infinity,
});
