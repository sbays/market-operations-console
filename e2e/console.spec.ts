import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("root redirects to the console", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/console$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Market Operations" }),
  ).toBeVisible();
});

test("console has no axe violations", async ({ page }) => {
  await page.goto("/console");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
