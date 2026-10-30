"use client";

/**
 * Linked highlighting: the entity being hovered or focused, shared by every view that draws
 * entities. Ephemeral UI state, so not the URL (a shared link shouldn't carry a hover, and
 * writing it there would flood history) and not React context (every consumer would
 * re-render on each hover). Views subscribe through a selector, so only they re-render.
 *
 * A module-level store is safe under PPR: it only ever changes in the browser, after an
 * interaction, and starts empty on the server, so no request sees another's state.
 */
import { create } from "zustand";
import { isLinked } from "@/domain/highlight";
import type { EntityPath } from "@/domain/schema";

/**
 * Pointer and focus are tracked apart, so a mouse passing over one item can't wipe the
 * highlight a keyboard user has on another. The pointer wins while it's over an item.
 */
type HighlightState = {
  pointer: EntityPath | null;
  focus: EntityPath | null;
};

const useHighlightStore = create<HighlightState>(() => ({
  pointer: null,
  focus: null,
}));

const shown = (state: HighlightState) => state.pointer ?? state.focus;

/** The drill path being hovered or focused, or null. */
export function useHighlightedPath(): EntityPath | null {
  return useHighlightStore(shown);
}

/**
 * Whether one item is linked to the highlight. The selector returns a boolean, so a
 * component using it re-renders only when its own emphasis turns on or off, not on every
 * hover elsewhere.
 */
export function useIsLinked(path: EntityPath | undefined): boolean {
  return useHighlightStore((state) => isLinked(path, shown(state)));
}

/**
 * Clears the highlight. The dashboard calls it when the selection changes: the hovered or
 * focused item usually unmounts in a drill without firing its leave or blur, and a stale
 * "eu.DE" would otherwise link every product of Germany at the next level.
 */
export function clearHighlight(): void {
  useHighlightStore.setState({ pointer: null, focus: null });
}

export type HighlightHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

/**
 * Handlers that highlight `path` while the item is hovered or focused. Not a hook (it only
 * writes to the store), so views can call it per item inside loops and chart render props.
 * Leaving or blurring only clears its own slot, and only if it still holds this item:
 * moving quickly can fire the next item's enter before this one's leave.
 */
export function highlightHandlers(path: EntityPath): HighlightHandlers {
  const release = (slot: keyof HighlightState) => () =>
    useHighlightStore.setState((state) =>
      state[slot] === path ? { [slot]: null } : state,
    );
  return {
    onMouseEnter: () => useHighlightStore.setState({ pointer: path }),
    onMouseLeave: release("pointer"),
    onFocus: () => useHighlightStore.setState({ focus: path }),
    onBlur: release("focus"),
  };
}

export type LinkedProps = Partial<HighlightHandlers> & {
  "data-linked"?: "true";
};

/**
 * Everything an item needs to take part in linked highlighting: the handlers, plus
 * `data-linked` while `linked`. `own` keeps an item's existing focus handler (a chart
 * point's roving tabindex) working alongside the highlight. Items with no path don't link.
 */
export function linkedProps(
  path: EntityPath | undefined,
  linked: boolean,
  own: { onFocus?: () => void } = {},
): LinkedProps {
  if (path === undefined) return own;
  const handlers = highlightHandlers(path);
  return {
    ...handlers,
    onFocus: () => {
      own.onFocus?.();
      handlers.onFocus();
    },
    "data-linked": linked ? "true" : undefined,
  };
}
