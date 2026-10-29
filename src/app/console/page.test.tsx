import { render, screen } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/data/QueryProvider";
import ConsolePage from "./page";

// cacheLife() needs Next's runtime; the cache scope doesn't change what the page renders.
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

/** The page inside the providers the root layout gives it. */
async function renderPage() {
  const page = await ConsolePage();
  render(
    <NuqsTestingAdapter>
      <QueryProvider>{page}</QueryProvider>
    </NuqsTestingAdapter>,
  );
}

describe("ConsolePage", () => {
  it("renders the page heading inside the main landmark", async () => {
    await renderPage();

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Market Operations" }),
    );
  });

  it("offers a skip link to the main content", async () => {
    await renderPage();

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveAttribute("href", "#main");
  });

  it("docks the assistant beside the dashboard with the suggested questions", async () => {
    await renderPage();

    const assistant = await screen.findByRole("complementary", {
      name: "Assistant",
    });
    expect(assistant).toHaveTextContent(
      "Why did Germany's revenue dip in March 2026?",
    );
  });
});
