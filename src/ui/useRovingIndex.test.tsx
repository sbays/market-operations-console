import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useRovingIndex } from "./useRovingIndex";

/** A 2×3 grid where some cells have no item, as a radar with missing values draws it. */
function Grid({ present }: { present: number[] }) {
  const roving = useRovingIndex(6, present[0], 3);
  return (
    <div>
      {present.map((index) => (
        <button key={index} type="button" {...roving.itemProps(index)}>
          {`Item ${index}`}
        </button>
      ))}
    </div>
  );
}

const item = (index: number) =>
  screen.getByRole("button", { name: `Item ${index}` });

describe("useRovingIndex", () => {
  it("moves through the grid by cell and by row", async () => {
    const user = userEvent.setup();
    render(<Grid present={[0, 1, 2, 3, 4, 5]} />);
    act(() => item(0).focus());

    await user.keyboard("{ArrowRight}");
    expect(item(1)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item(4)).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item(4)).toHaveFocus();
  });

  it("skips cells with no item", async () => {
    const user = userEvent.setup();
    render(<Grid present={[0, 1, 3, 5]} />);
    act(() => item(1).focus());

    await user.keyboard("{ArrowRight}");
    expect(item(3)).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(item(1)).toHaveFocus();
    await user.keyboard("{End}");
    expect(item(5)).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item(0)).toHaveFocus();
  });
});
