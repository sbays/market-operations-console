import { createContext } from "react";
import type { Citation } from "@/domain/schema";

/** The answer's citations once the final event arrives; undefined while still streaming. */
export const CitationsContext = createContext<Citation[] | undefined>(
  undefined,
);
