import { describe, expect, it } from "vitest";
import { sortRows } from "./table";

type Row = { name: string; revenue: number | undefined };

const rows: Row[] = [
  { name: "Spain", revenue: 5 },
  { name: "Germany", revenue: undefined },
  { name: "France", revenue: 10 },
  { name: "Italy", revenue: 5 },
];

const byRevenue = (row: Row) => row.revenue;
const byName = (row: Row) => row.name;
const names = (sorted: Row[]) => sorted.map((row) => row.name);

describe("sortRows", () => {
  it("sorts numbers ascending and descending", () => {
    expect(names(sortRows(rows, byRevenue, "ascending"))).toEqual([
      "Spain",
      "Italy",
      "France",
      "Germany",
    ]);
    expect(names(sortRows(rows, byRevenue, "descending"))).toEqual([
      "France",
      "Spain",
      "Italy",
      "Germany",
    ]);
  });

  it("sorts text alphabetically, and reverses it for descending", () => {
    expect(names(sortRows(rows, byName, "ascending"))).toEqual([
      "France",
      "Germany",
      "Italy",
      "Spain",
    ]);
    expect(names(sortRows(rows, byName, "descending"))).toEqual([
      "Spain",
      "Italy",
      "Germany",
      "France",
    ]);
  });

  it("puts missing values last in both directions", () => {
    expect(names(sortRows(rows, byRevenue, "ascending")).at(-1)).toBe(
      "Germany",
    );
    expect(names(sortRows(rows, byRevenue, "descending")).at(-1)).toBe(
      "Germany",
    );
  });

  it("keeps rows with equal values in their original order", () => {
    // Spain and Italy are both 5; they keep the order the rows came in.
    expect(names(sortRows(rows, byRevenue, "ascending")).slice(0, 2)).toEqual([
      "Spain",
      "Italy",
    ]);
    expect(names(sortRows(rows, byRevenue, "descending")).slice(1, 3)).toEqual([
      "Spain",
      "Italy",
    ]);
  });

  it("leaves the rows it was given unsorted", () => {
    const before = names(rows);
    sortRows(rows, byRevenue, "descending");
    expect(names(rows)).toEqual(before);
  });
});
