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

test("a cited answer drills the dashboard, and Back undoes it", async ({
  page,
}) => {
  await page.goto("/console");
  const assistant = page.getByRole("complementary", { name: "Assistant" });

  await assistant
    .getByRole("button", {
      name: "Why did Germany's revenue dip in March 2026?",
    })
    .click();
  await expect(assistant.getByText("High confidence")).toBeVisible();

  const chip = assistant.getByRole("button", {
    name: "DE · Mar 2026 · Revenue",
  });
  await chip.focus();
  await expect(page.getByRole("tooltip")).toContainText(
    "Source data: Germany, Mar 2026, Revenue: $4M",
  );

  await chip.click();
  await expect(page).toHaveURL(/path=eu\.DE&period=2026-03/);
  await page.goBack();
  await expect(page).toHaveURL(/\/console$/);
});

test("console with an answer on screen has no axe violations", async ({
  page,
}) => {
  await page.goto("/console");
  const assistant = page.getByRole("complementary", { name: "Assistant" });
  await assistant
    .getByRole("button", {
      name: "Why did Germany's revenue dip in March 2026?",
    })
    .click();
  await expect(assistant.getByText("High confidence")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("the dashboard drills through the breakdown, and Back goes up", async ({
  page,
}) => {
  await page.goto("/console");
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });

  await page
    .getByRole("table", { name: /Portfolio by region/ })
    .getByRole("button", { name: "Europe" })
    .click();
  await page
    .getByRole("table", { name: /Europe by market/ })
    .getByRole("button", { name: "Germany" })
    .click();

  await expect(page).toHaveURL(/\?path=eu\.DE$/);
  await expect(breadcrumb).toHaveText(/Portfolio.*Europe.*Germany/);
  await expect(
    page.getByRole("img", { name: /^Germany revenue, / }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.goBack();
  await expect(page).toHaveURL(/\?path=eu$/);
  await expect(breadcrumb.getByText("Europe")).toHaveAttribute(
    "aria-current",
    "page",
  );
});
