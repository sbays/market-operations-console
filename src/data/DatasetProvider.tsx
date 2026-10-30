"use client";

import { createContext, type ReactNode } from "react";
import type { Dataset } from "@/domain/schema";

export const DatasetContext = createContext<Dataset | null>(null);

/** Hands the dataset the server validated to the client components under it. */
export function DatasetProvider({
  dataset,
  children,
}: {
  dataset: Dataset;
  children: ReactNode;
}) {
  return <DatasetContext value={dataset}>{children}</DatasetContext>;
}
