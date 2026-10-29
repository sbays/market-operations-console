"use client";

import { useState, type KeyboardEvent } from "react";

type ItemProps = {
  tabIndex: 0 | -1;
  "data-roving-index": number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onFocus: () => void;
};

/**
 * Roving tabindex for sibling items (chart points, grid cells): one item is in the tab
 * order, arrow keys and Home/End move focus between them, stopping at the edges. The tab stop
 * is `preferredIndex` (e.g. the selected month) until the user moves focus themselves.
 * Siblings are found through the DOM, so there are no per-item refs to keep in sync.
 */
export function useRovingIndex(
  count: number,
  preferredIndex = count - 1,
  /** For a grid laid out in rows of `columns`: ArrowUp/ArrowDown move a whole row. */
  columns?: number,
) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const clamp = (index: number) => Math.max(0, Math.min(index, count - 1));
  const activeIndex = clamp(focusedIndex ?? preferredIndex);

  function itemProps(index: number): ItemProps {
    return {
      tabIndex: index === activeIndex ? 0 : -1,
      "data-roving-index": index,
      onFocus: () => setFocusedIndex(index),
      onKeyDown: (event) => {
        const row = columns ?? 1;
        const next = {
          ArrowRight: index + 1,
          ArrowDown: index + row,
          ArrowLeft: index - 1,
          ArrowUp: index - row,
          Home: 0,
          End: count - 1,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        // Past an edge, stay put (a grid's top row doesn't wrap to the first cell).
        if (next < 0 || next >= count) return;
        event.currentTarget.parentElement
          ?.querySelector<HTMLElement>(`[data-roving-index="${next}"]`)
          ?.focus();
      },
    };
  }

  return { activeIndex, itemProps };
}
