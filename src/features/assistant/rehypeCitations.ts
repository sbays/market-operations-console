/**
 * Turns each complete citation marker "[n]" in the answer into a <cite data-citation=n>
 * element, which the answer body renders as a citation chip. A marker still arriving
 * ("[1" at the end of a streaming block) stays text until it completes. Code is left alone.
 */
import type { ElementContent, Root, RootContent } from "hast";

const MARKER = /\[(\d+)\]/g;
const LITERAL = new Set(["code", "pre"]);

function splitMarkers(value: string): ElementContent[] {
  const parts: ElementContent[] = [];
  let last = 0;
  for (const match of value.matchAll(MARKER)) {
    if (match.index > last) {
      parts.push({ type: "text", value: value.slice(last, match.index) });
    }
    parts.push({
      type: "element",
      tagName: "cite",
      properties: { dataCitation: Number(match[1]) },
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
  }
  if (last < value.length)
    parts.push({ type: "text", value: value.slice(last) });
  return parts;
}

function transform(children: ElementContent[]): ElementContent[] {
  return children.flatMap((child) => {
    if (child.type === "text") return splitMarkers(child.value);
    if (child.type === "element" && !LITERAL.has(child.tagName)) {
      return [{ ...child, children: transform(child.children) }];
    }
    return [child];
  });
}

export function rehypeCitations() {
  return (tree: Root) => {
    tree.children = tree.children.flatMap<RootContent>((child) =>
      child.type === "element" || child.type === "text"
        ? transform([child])
        : [child],
    );
  };
}
