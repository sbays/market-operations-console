import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("chart exploded");
}

describe("ErrorBoundary", () => {
  it("shows a notice in place of a failed panel, keeps its siblings, and logs the error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <ErrorBoundary label="Market map">
          <Broken />
        </ErrorBoundary>
        <p>Still here</p>
      </>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Market map couldn't be shown.",
    );
    expect(screen.getByText("Still here")).toBeInTheDocument();
    expect(logged).toHaveBeenCalledWith(
      "Market map failed:",
      expect.objectContaining({ message: "chart exploded" }),
      expect.stringContaining("Broken"),
    );
    logged.mockRestore();
  });
});
