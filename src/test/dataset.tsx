import type { ReactNode } from "react";
import { DatasetProvider } from "@/data/DatasetProvider";
import { loadDataset } from "@/data/pack";

/** The real dataset, as the console provides it. */
export function TestDataset({ children }: { children: ReactNode }) {
  return <DatasetProvider dataset={loadDataset()}>{children}</DatasetProvider>;
}
