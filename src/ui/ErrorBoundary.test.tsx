import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Broken(): never {
  throw new Error("chart exploded");
}

/** Fails only for one selection, as a chart might on one entity's odd data. */
function FailsFor({ path }: { path: string }) {
  if (path === "eu.DE") throw new Error("bad data");
  return <p>Chart for {path}</p>;
}

describe("ErrorBoundary", () => {
  it("shows a notice in place of a failed panel, keeps its siblings, and logs the error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <>
        <ErrorBoundary label="Market map" resetKey="eu">
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

  it("tries the panel again when the selection changes", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const panel = (path: string) => (
      <ErrorBoundary label="Market map" resetKey={path}>
        <FailsFor path={path} />
      </ErrorBoundary>
    );

    const { rerender } = render(panel("eu.DE"));
    expect(screen.getByRole("status")).toBeInTheDocument();

    rerender(panel("eu.FR"));
    expect(screen.getByText("Chart for eu.FR")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    logged.mockRestore();
  });
});
