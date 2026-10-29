import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearHighlight,
  highlightHandlers,
  useHighlightedPath,
  useIsLinked,
} from "./highlight";

afterEach(() => act(() => clearHighlight()));

function setup() {
  const highlighted = renderHook(() => useHighlightedPath());
  return {
    germany: { current: highlightHandlers("eu.DE") },
    france: { current: highlightHandlers("eu.FR") },
    highlighted: highlighted.result,
  };
}

describe("highlight state", () => {
  it("highlights an item on hover and clears it on leave", () => {
    const { germany, highlighted } = setup();
    expect(highlighted.current).toBeNull();

    act(() => germany.current.onMouseEnter());
    expect(highlighted.current).toBe("eu.DE");

    act(() => germany.current.onMouseLeave());
    expect(highlighted.current).toBeNull();
  });

  it("treats keyboard focus the same as hover", () => {
    const { germany, highlighted } = setup();

    act(() => germany.current.onFocus());
    expect(highlighted.current).toBe("eu.DE");

    act(() => germany.current.onBlur());
    expect(highlighted.current).toBeNull();
  });

  it("ignores a late leave from an item that is no longer highlighted", () => {
    // Moving quickly from Germany to France can fire France's enter before Germany's leave.
    const { germany, france, highlighted } = setup();

    act(() => germany.current.onMouseEnter());
    act(() => france.current.onMouseEnter());
    act(() => germany.current.onMouseLeave());
    expect(highlighted.current).toBe("eu.FR");
  });

  it("keeps a keyboard user's focus highlight when the mouse passes over something else", () => {
    const { germany, france, highlighted } = setup();

    act(() => france.current.onFocus());
    act(() => germany.current.onMouseEnter());
    // The pointer wins while it's over an item.
    expect(highlighted.current).toBe("eu.DE");

    act(() => germany.current.onMouseLeave());
    expect(highlighted.current).toBe("eu.FR");
  });

  it("clears both pointer and focus highlights", () => {
    const { germany, france, highlighted } = setup();
    act(() => france.current.onFocus());
    act(() => germany.current.onMouseEnter());

    act(() => clearHighlight());
    expect(highlighted.current).toBeNull();
  });

  it("answers per item whether it is linked, including parent and child", () => {
    const { germany } = setup();
    const europe = renderHook(() => useIsLinked("eu"));
    const france = renderHook(() => useIsLinked("eu.FR"));

    act(() => germany.current.onMouseEnter());
    expect(europe.result.current).toBe(true);
    expect(france.result.current).toBe(false);
  });
});
