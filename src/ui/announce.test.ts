import { afterEach, describe, expect, it } from "vitest";
import { announce, POLITE_REGION_ID, URGENT_REGION_ID } from "./announce";

function mountRegion(id: string) {
  const region = document.createElement("div");
  region.id = id;
  document.body.append(region);
  return region;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("announce", () => {
  it("writes to the polite region unless the message is urgent", () => {
    const polite = mountRegion(POLITE_REGION_ID);
    const urgent = mountRegion(URGENT_REGION_ID);

    announce("Saved.");
    expect(polite.textContent).toBe("Saved.");
    expect(urgent.textContent).toBe("");

    announce("Failed.", { urgent: true });
    expect(urgent.textContent).toBe("Failed.");
  });

  it("changes the region's text when the same message repeats", () => {
    const region = mountRegion(POLITE_REGION_ID);

    announce("Failed.");
    announce("Failed.");
    expect(region.textContent).toBe("Failed. ");

    announce("Failed.");
    expect(region.textContent).toBe("Failed.");
  });

  it("does nothing when no region is mounted", () => {
    expect(() => announce("Saved.")).not.toThrow();
  });
});
