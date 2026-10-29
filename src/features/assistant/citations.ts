import { createContext } from "react";
import type { Citation } from "@/domain/schema";

/**
 * The answer's evidence. Pending while the answer streams; settled once the stream ends,
 * with the final event's citations, or none when the answer stopped, failed or abstained.
 */
export type Evidence =
  { settled: false } | { settled: true; citations: Citation[] };

export const PENDING: Evidence = { settled: false };
export const NO_EVIDENCE: Evidence = { settled: true, citations: [] };

export const EvidenceContext = createContext<Evidence>(PENDING);
