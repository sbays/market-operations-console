/**
 * Linked highlighting: which items emphasise together when one is hovered or focused. Items
 * are keyed by drill path (pathOf), the same id the URL uses.
 */

import { isAncestorPath } from "./selectors";

/**
 * Whether an item should be emphasised while `highlighted` is. The same entity links, and so
 * do a parent and child, because views can show different levels at once (at the portfolio
 * the map shows markets while the other views show regions). The portfolio ("") never links:
 * as everyone's ancestor it would light up every view.
 */
export function isLinked(item: string, highlighted: string | null): boolean {
  if (highlighted === null || highlighted === "" || item === "") return false;
  return (
    item === highlighted ||
    isAncestorPath(highlighted, item) ||
    isAncestorPath(item, highlighted)
  );
}
