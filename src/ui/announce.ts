/** The ids of the two live regions that LiveRegions mounts once per page. */
export const POLITE_REGION_ID = "live-polite";
export const URGENT_REGION_ID = "live-urgent";

/**
 * Reads `message` aloud through a live region that is already on the page. Only the text of
 * that region changes: screen readers announce text arriving in a node they already watch far
 * more reliably than a new subtree appearing. `urgent` interrupts the reader, so it is for a
 * failure the person has to act on; the default waits for a pause, for confirmations.
 *
 * The same message twice would be no change to read, so a repeat (a retry that fails again)
 * gains a non-breaking space. With no LiveRegions mounted, the call does nothing.
 */
export function announce(
  message: string,
  { urgent = false }: { urgent?: boolean } = {},
): void {
  const region = document.getElementById(
    urgent ? URGENT_REGION_ID : POLITE_REGION_ID,
  );
  if (!region) return;
  region.textContent =
    region.textContent === message ? `${message}\u00A0` : message;
}
