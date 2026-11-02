import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnswerBody } from "./AnswerBody";

const parsed = vi.hoisted(() => vi.fn<(text: string) => void>());

// Counts parses at the boundary we pay for; Vitest doesn't run the React Compiler.
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    parsed(children);
    return <p>{children}</p>;
  },
}));

const parsesOf = (text: string) =>
  parsed.mock.calls.filter(([block]) => block === text).length;

describe("AnswerBody", () => {
  beforeEach(() => parsed.mockClear());

  it("parses a settled block once while a later block grows", () => {
    const settled = "First paragraph.";
    const { rerender } = render(<AnswerBody text={`${settled}\n\nSec`} />);

    rerender(<AnswerBody text={`${settled}\n\nSecond`} />);

    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(parsesOf(settled)).toBe(1);
    expect(parsesOf("Second")).toBe(1);
  });
});
