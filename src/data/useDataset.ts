"use client";

import { use } from "react";
import type { Dataset } from "@/domain/schema";
import { DatasetContext } from "./DatasetProvider";

/**
 * The validated dataset. It is static and loaded on the server, so there is nothing to fetch,
 * refetch or invalidate, and context is enough. Against a real API this would be a TanStack
 * Query read, as data/alerts.ts is; features call only this hook, so they wouldn't change.
 */
export function useDataset(): Dataset {
  const dataset = use(DatasetContext);
  if (dataset === null) throw new Error("useDataset needs a DatasetProvider");
  return dataset;
}
