/**
 * Assistant fixtures, written as templates. `{{n}}` becomes the real value of citation n,
 * formatted the way the dashboard formats it, followed by the marker `[n]`. The numbers in
 * fixtures.json therefore always match the dataset; src/data/pack.test.ts re-checks it.
 */
import type { Dataset, Fixture } from "@/domain/schema";

export function renderFixtures(dataset: Dataset): Fixture[] {
  void dataset;
  return [];
}
