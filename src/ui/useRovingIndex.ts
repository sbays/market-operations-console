"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type ItemProps = {
  tabIndex: 0 | -1;
  ref: (el: HTMLElement | null) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onFocus: () => void;
};

/**
 * Roving tabindex for a row of items (tabs, chart points, table cells):
 * one item is in the tab order, arrow keys and Home/End move focus between them.
 * Movement clamps at the ends rather than wrapping.
 */
export function useRovingIndex(count: number, initialIndex = count - 1) {
  const [requestedIndex, setActiveIndex] = useState(initialIndex);
  const elements = useRef(new Map<number, HTMLElement>());
  // Clamp at read time so the active item stays valid if the count shrinks.
  const activeIndex = Math.max(0, Math.min(requestedIndex, count - 1));

  function focusItem(index: number) {
    const next = Math.max(0, Math.min(index, count - 1));
    setActiveIndex(next);
    elements.current.get(next)?.focus();
  }

  function itemProps(index: number): ItemProps {
    return {
      tabIndex: index === activeIndex ? 0 : -1,
      ref: (el) => {
        if (el) elements.current.set(index, el);
        else elements.current.delete(index);
      },
      onFocus: () => setActiveIndex(index),
      onKeyDown: (event) => {
        switch (event.key) {
          case "ArrowRight":
          case "ArrowDown":
            focusItem(index + 1);
            break;
          case "ArrowLeft":
          case "ArrowUp":
            focusItem(index - 1);
            break;
          case "Home":
            focusItem(0);
            break;
          case "End":
            focusItem(count - 1);
            break;
          default:
            return;
        }
        event.preventDefault();
      },
    };
  }

  return { activeIndex, itemProps };
}
