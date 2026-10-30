import { POLITE_REGION_ID, URGENT_REGION_ID } from "./announce";

/**
 * The two regions announce() writes into. They stay empty and mounted, so they already exist
 * when a message arrives. role="status" is polite; role="alert" is assertive.
 */
export function LiveRegions() {
  return (
    <>
      <div id={POLITE_REGION_ID} role="status" className="sr-only" />
      <div id={URGENT_REGION_ID} role="alert" className="sr-only" />
    </>
  );
}
