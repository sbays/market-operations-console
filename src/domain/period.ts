/**
 * Period types, schemas and the one parser for them: months ("2026-03") and quarters ("2026-Q3").
 * The types are template literals, so a month can't be passed where a quarter is required and
 * an arbitrary string isn't a period; values are built only through the guards below.
 */
import { z } from "zod";

type MonthNumber =
  | "01"
  | "02"
  | "03"
  | "04"
  | "05"
  | "06"
  | "07"
  | "08"
  | "09"
  | "10"
  | "11"
  | "12";

export type Month = `${number}-${MonthNumber}`;
export type Quarter = `${number}-Q${1 | 2 | 3 | 4}`;
/** What a citation or selection can refer to: one month or one quarter. */
export type PeriodRef = Month | Quarter;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER = /^(\d{4})-Q([1-4])$/;

export function isMonth(value: unknown): value is Month {
  return typeof value === "string" && MONTH.test(value);
}

export function isQuarter(value: unknown): value is Quarter {
  return typeof value === "string" && QUARTER.test(value);
}

export const MonthSchema = z.custom<Month>(
  isMonth,
  "Expected a month like 2026-03",
);
export const QuarterSchema = z.custom<Quarter>(
  isQuarter,
  "Expected a quarter like 2026-Q3",
);
export const PeriodRefSchema = z.union([MonthSchema, QuarterSchema]);

export type ParsedPeriod =
  | { kind: "month"; year: number; month: number }
  | { kind: "quarter"; year: number; quarter: number };

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

export function monthKey(year: number, month: number): Month {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  if (!isMonth(key)) throw new RangeError(`Not a month: ${key}`);
  return key;
}

export function quarterKey(year: number, quarter: number): Quarter {
  const key = `${year}-Q${quarter}`;
  if (!isQuarter(key)) throw new RangeError(`Not a quarter: ${key}`);
  return key;
}

export function monthsOfQuarter(year: number, quarter: number): Month[] {
  const first = (quarter - 1) * 3 + 1;
  return [first, first + 1, first + 2].map((month) => monthKey(year, month));
}

/** The month after `year-month`. */
export function nextMonth(year: number, month: number): Month {
  return month === 12 ? monthKey(year + 1, 1) : monthKey(year, month + 1);
}
