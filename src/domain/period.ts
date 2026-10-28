/** The one parser for period strings: months ("2026-03") and quarters ("2026-Q3"). */

export type ParsedPeriod =
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: number };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER = /^(\d{4})-Q([1-4])$/;

export function parsePeriod(period: string): ParsedPeriod | undefined {
  const month = MONTH.exec(period);
  if (month) {
    return { kind: "month", year: Number(month[1]), month: Number(month[2]) };
  }
  const quarter = QUARTER.exec(period);
  if (quarter) {
    return {
      kind: "quarter",
      year: Number(quarter[1]),
      quarter: Number(quarter[2]),
    };
  }
  return undefined;
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function quarterKey(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

export function monthsOfQuarter(year: number, quarter: number): string[] {
  const first = (quarter - 1) * 3 + 1;
  return [first, first + 1, first + 2].map((month) => monthKey(year, month));
}

/** The month after `year-month`, as a key. */
export function nextMonth(year: number, month: number): string {
  return month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
}
