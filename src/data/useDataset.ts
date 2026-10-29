"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { Dataset } from "@/domain/schema";
import { datasetQuery } from "./queries";

/** The validated dataset. Always present on the client: DatasetHydration seeds it. */
export function useDataset(): Dataset {
  return useSuspenseQuery(datasetQuery).data;
}
