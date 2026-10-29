"use client";

import { useReportWebVitals } from "next/web-vitals";
import { formatWebVital } from "@/domain/format";

/**
 * Logs each reading. Module-level, so its identity never changes: the hook re-registers
 * whenever the callback changes, and web-vitals listeners can't be removed, so a new function
 * per render (without the React Compiler) would log every vital more than once.
 */
function logWebVital(metric: Parameters<typeof formatWebVital>[0]) {
  console.info(`[web-vitals] ${formatWebVital(metric)}`);
}

/**
 * Core Web Vitals (CLS, LCP, INP, FCP and TTFB) logged to the console. A production build
 * would send them to an analytics endpoint instead; the README describes that.
 */
export function WebVitals() {
  useReportWebVitals(logWebVital);
  return null;
}
