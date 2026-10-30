# Keyboard and VoiceOver checklist

The manual pass before submission. axe runs in CI; this covers what it can't. Use Safari for
VoiceOver (VO = Control + Option). Record each result as ✅, ❌ or a short note.

## Keyboard (Chrome or Safari, no mouse)

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 1 | Load `/console`, press Tab once | "Skip to main content" appears; Enter moves to the main content | ✅|
| 2 | Keep pressing Tab through the page | Order: New alert, breadcrumb links, mode toggle, top-risk names, map, trend, heat map, radar, detail table, then the assistant. Every stop has a visible focus ring | ✅|
| 3 | Tab into the trend chart, press ← → Home End | Focus moves between months; one Tab leaves the chart | ✅|
| 4 | Press Enter on a month | Key figures switch to that month; Back does not undo it (period replaces history) | ✅|
| 5 | Tab into the heat map, press ↑ ↓ ← → | Focus moves across cells and rows, stopping at the edges | ✅|
| 6 | Tab into the map, press → and Enter | Focus steps between markets; Enter drills into that market | ✅|
| 7 | With focus anywhere in the dashboard at Germany, press Escape | Goes up to Europe; Back returns to Germany | ✅|
| 8 | Toggle a "View as table" button | The chart becomes a table with the same figures; toggling back restores the chart | ✅|
| 9 | Sort the detail table by Revenue, twice | Rows reorder high to low, then low to high | ✅|
| 10 | Open New alert, press Tab repeatedly | Focus stays inside the dialog; Escape closes it and focus returns to New alert | ✅|
| 11 | Open New alert, press Save with the form empty | Focus moves to "Fix these before saving"; each listed error moves focus to its field | ✅|
| 12 | In the assistant, pick a suggested question, then Tab to a citation chip | Tooltip shows the source value; Enter drills, and focus lands on the key figures | ✅|
| 13 | Ask a long question and press Stop | The partial answer stays and is labelled as partial | ✅|

## VoiceOver (Safari)

| # | Step | Expected announcement | Result |
| --- | --- | --- | --- |
| 1 | VO + U, then Landmarks | Main, Assistant (complementary), Breadcrumb navigation | ✅|
| 2 | Move to the trend chart | Its summary sentence ("Europe revenue, Oct 2024 to Sep 2026: …"), read once | ✅|
| 3 | Move to a chart point | Month, revenue, forecast (and prior year in analyst mode) | ✅|
| 4 | Move to a status badge | The status in words ("At risk"), not just a colour | ✅|
| 5 | Ask a suggested question | Polite announcements when the answer starts and when it finishes, not every word | ✅|
| 6 | Move through the answer card | The "AI-generated" label, the confidence badge in words, each citation chip | ✅|
| 7 | Ask "What will revenue be in Q1 2027?" | The abstention card ("This isn't in the data") and what the data covers | ✅|
| 8 | Open `/console?fail=1`, save an alert rule | "Couldn't save the alert rule." with a Retry button | ✅|
| 9 | Save a rule without `fail` | "Saved alert rule …" | ✅|
| 10 | Open `/console?path=xx.YY` | "That link points to something not in the data, …" | ✅|
| 11 | Switch mode to Exec | The pressed state of the Exec button | ✅|

## Reduced motion

| # | Step | Expected | Result |
| --- | --- | --- | --- |
| 1 | macOS Settings › Accessibility › Display › Reduce motion on; ask a question | No pulsing skeleton or caret; tooltips and the dialog appear without animation | ✅|

## Fixes re-checked

| Issue | Fix | Result |
| --- | --- | --- |
| VoiceOver didn't read the failed-save toast (`/console?fail=1`) | Toast messages now go through always-mounted live regions (`src/ui/announce.ts`); a failed save uses `role="alert"` and names Alt+T for Retry, and sonner's own region is off | ✅ Read aloud by VoiceOver |
