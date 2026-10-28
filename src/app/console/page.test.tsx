import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ConsolePage from "./page";

describe("ConsolePage", () => {
  it("renders the page heading inside the main landmark", () => {
    render(<ConsolePage />);

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Market Operations" }),
    );
  });

  it("offers a skip link to the main content", () => {
    render(<ConsolePage />);

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
  });
});
