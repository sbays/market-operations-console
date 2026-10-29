"use client";

import { useReportWebVitals } from "next/web-vitals";
import { formatWebVital } from "@/domain/format";

/**
 * Real-user metrics (LCP, INP, CLS and the rest) logged to the console. A production build
 * would send them to an analytics endpoint instead; the README describes that.
 */
export function WebVitals() {
  useReportWebVitals((metric) => {
    console.info(`[web-vitals] ${formatWebVital(metric)}`);
  });
  return null;
}
