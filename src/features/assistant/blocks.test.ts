import { describe, expect, it } from "vitest";
import { splitBlocks } from "./blocks";

describe("splitBlocks", () => {
  it("splits paragraphs on blank lines", () => {
    expect(splitBlocks("")).toEqual([]);
    expect(splitBlocks("One.\n\nTwo.\n\n\nThree.")).toEqual([
      "One.",
      "Two.",
      "Three.",
    ]);
  });

  it("keeps a loose list together, so it stays one list", () => {
    expect(
      splitBlocks("Intro:\n\n- **Brazil** [1]\n\n- **Japan** [2]\n\nOutro."),
    ).toEqual(["Intro:", "- **Brazil** [1]\n\n- **Japan** [2]", "Outro."]);
    expect(splitBlocks("1. First\n\n2. Second")).toEqual([
      "1. First\n\n2. Second",
    ]);
  });

  it("leaves settled blocks unchanged while the last one grows", () => {
    const before = splitBlocks("One.\n\nTw");
    const after = splitBlocks("One.\n\nTwo is longer");
    expect(after[0]).toBe(before[0]);
    expect(after).toEqual(["One.", "Two is longer"]);
  });
});
