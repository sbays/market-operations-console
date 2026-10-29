/**
 * Sorting for the detail table. Pure, so the order a reader sees is tested without rendering.
 */

export type SortDirection = "ascending" | "descending";

/** A sortable cell: a number for figures, text for names, undefined where there is no value. */
export type SortValue = string | number | undefined;

/** Compares two present values of the same kind; mixed kinds fall back to their text. */
function compareValues(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * A sorted copy of `rows`. Missing values sort last in both directions, so a gap never jumps
 * to the top when a reader flips the order. Rows with equal values keep their original order.
 */
export function sortRows<T>(
  rows: readonly T[],
  valueOf: (row: T) => SortValue,
  direction: SortDirection,
): T[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort((rowA, rowB) => {
    const a = valueOf(rowA);
    const b = valueOf(rowB);
    if (a === undefined && b === undefined) return 0;
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return sign * compareValues(a, b);
  });
}
