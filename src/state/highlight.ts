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

type HighlightState = { path: string | null };

const useHighlightStore = create<HighlightState>(() => ({ path: null }));

/** The drill path being hovered or focused, or null. */
export function useHighlightedPath(): string | null {
  return useHighlightStore((state) => state.path);
}

/** Clears the highlight. For tests, which share the module-level store. */
export function resetHighlight(): void {
  useHighlightStore.setState({ path: null });
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
 * Pointer and focus events both drive it, so keyboard users get the same emphasis. Leaving
 * only clears the highlight if it is still this item's: moving quickly can fire the next
 * item's enter before this one's leave.
 */
export function highlightHandlers(path: string): HighlightHandlers {
  const show = () => useHighlightStore.setState({ path });
  const hide = () =>
    useHighlightStore.setState((state) =>
      state.path === path ? { path: null } : state,
    );
  return {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };
}
