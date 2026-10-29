import type { AlertRule } from "@/domain/alert";
import { createAlertsHandlers } from "./handler";

/**
 * Module-level, so it lives as long as this server instance: a restart or a second instance
 * starts empty. That is the mock's contract, not a bug.
 */
const store: AlertRule[] = [];

export const { GET, POST } = createAlertsHandlers({
  saveDelayMs: 400,
  failDelayMs: 600,
  store,
});
