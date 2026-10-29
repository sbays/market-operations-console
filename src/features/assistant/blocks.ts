/**
 * Splits an answer into top-level Markdown blocks, so each settled block renders once and
 * only the block still streaming is re-parsed per frame.
 */
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s/;

export function splitBlocks(text: string): string[] {
  const blocks: string[] = [];
  for (const block of text.split(/\n{2,}/)) {
    if (block.trim() === "") continue;
    const previous = blocks.at(-1);
    // A list with blank lines between items is still one list: keep it in one block.
    if (
      previous !== undefined &&
      LIST_ITEM.test(previous) &&
      LIST_ITEM.test(block)
    ) {
      blocks[blocks.length - 1] = `${previous}\n\n${block}`;
    } else {
      blocks.push(block);
    }
  }
  return blocks;
}
