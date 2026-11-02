/**
 * What a citation points at in the data. The pack's citations name ids loosely (any of
 * market, region, product and period); this turns one into an EntityRef and a month the
 * dataset contains, or says it can't.
 */
import type { Citation, Dataset, EntityRef, Month } from "./schema";
import { coverageOf, expandPeriod, pathOf } from "./selectors";

export type ResolvedCitation = { ref: EntityRef; period: Month };

/** The most specific entity a citation names, before checking the data has it. */
function citedRef(citation: Citation): EntityRef | undefined {
  const { marketId, regionId, productId } = citation;
  // A product is only an entity within a market (EntityRef), so a bare product is unresolved.
  if (productId !== undefined) {
    return marketId === undefined
      ? undefined
      : { level: "product", marketId, id: productId };
  }
  if (marketId !== undefined) return { level: "market", id: marketId };
  if (regionId !== undefined) return { level: "region", id: regionId };
  return undefined;
}

/**
 * The entity and month a citation points at, or undefined when the data doesn't have them.
 * A citation without a period cites the latest month, the one the pack states its KPIs for.
 * A market cited with a region must be in that region.
 */
export function resolveCitation(
  dataset: Dataset,
  citation: Citation,
): ResolvedCitation | undefined {
  const ref = citedRef(citation);
  if (!ref || pathOf(dataset, ref) === undefined) return undefined;
  if (ref.level === "region" && !dataset.regions.some((r) => r.id === ref.id)) {
    return undefined;
  }
  if (ref.level === "product") {
    if (!dataset.products.some((p) => p.id === ref.id)) return undefined;
  }
  if (
    citation.regionId !== undefined &&
    (ref.level === "market" || ref.level === "product")
  ) {
    const marketId = ref.level === "market" ? ref.id : ref.marketId;
    const market = dataset.markets.find((m) => m.id === marketId);
    if (market?.regionId !== citation.regionId) return undefined;
  }
  const period = citation.period ?? coverageOf(dataset).to;
  if (expandPeriod(dataset, period).length === 0) return undefined;
  return { ref, period };
}
