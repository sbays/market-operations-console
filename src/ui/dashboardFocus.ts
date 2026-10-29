/**
 * Where a drill from outside the dashboard sends focus: the key figures for the new selection.
 * A DOM id, so the assistant can hand focus over without importing the dashboard.
 */
export const DASHBOARD_FOCUS_ID = "dashboard-key-figures";

/**
 * Moves focus to the dashboard's key figures, so keyboard and screen-reader users land on the
 * numbers that check the answer instead of staying in the chat.
 */
export function focusDashboard(): void {
  document.getElementById(DASHBOARD_FOCUS_ID)?.focus();
}
