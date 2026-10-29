/**
 * Splits an answer into top-level Markdown blocks, so each settled block renders once and
 * only the block still streaming is re-parsed per frame.
 */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;
const INDENTED = /^\s/;
const FENCE_LINE = /^\s*(?:```|~~~)/gm;

/** Whether a chunk opens or closes a code fence (an odd number of fence lines). */
function togglesFence(chunk: string): boolean {
  return (chunk.match(FENCE_LINE)?.length ?? 0) % 2 === 1;
}

export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  let inFence = false;
  // Keep the separators: inside a code fence, blank lines are content.
  const parts = text.split(/(\n{2,})/);
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = parts[i] ?? "";
    const separator = parts[i - 1] ?? "\n\n";
    const previous = blocks.at(-1);
    // A fence spans blank lines, and so does a loose list with its indented continuations.
    const continues =
      previous !== undefined &&
      (inFence ||
        (LIST_ITEM.test(previous) &&
          (LIST_ITEM.test(chunk) || INDENTED.test(chunk))));
    if (continues) {
      blocks[blocks.length - 1] = `${previous}${separator}${chunk}`;
    } else if (chunk.trim() !== "") {
      blocks.push(chunk);
    }
    if (togglesFence(chunk)) inFence = !inFence;
  }
  return blocks;
}
