/**
 * Saves the README screenshots to docs/screenshots. Not a test suite: CI ignores this folder,
 * and it runs only through `pnpm screenshots` (playwright.screenshots.config.ts).
 */
import { expect, test, type Page } from "@playwright/test";

const OUT = "docs/screenshots";

async function ask(page: Page, question: string) {
  const assistant = page.getByRole("complementary", { name: "Assistant" });
  await assistant.getByRole("button", { name: question }).click();
  return assistant;
}

/**
 * Waits until the page has finished drawing: the map loads after the rest of the dashboard,
 * each chart draws only once it has measured its container, and alert rules load from the API.
 */
async function settled(page: Page) {
  await expect(
    page.getByRole("figure", { name: "Markets by attainment" }),
  ).toBeVisible();
  for (const figure of await page.getByRole("figure").all()) {
    await expect(figure.locator('svg[role="img"]')).toBeVisible();
  }
  await expect(page.getByText("Loading alert rules…")).toHaveCount(0);
}

test("exec view", async ({ page }) => {
  await page.goto("/console?path=eu&mode=exec");
  await expect(page.getByRole("region", { name: "Top risks" })).toBeVisible();
  await settled(page);
  await page.screenshot({ path: `${OUT}/exec-view.png`, fullPage: true });
});

test("analyst view", async ({ page }) => {
  await page.goto("/console?path=eu");
  await expect(page.getByRole("figure", { name: "Compare" })).toBeVisible();
  await settled(page);
  await page.screenshot({ path: `${OUT}/analyst-view.png`, fullPage: true });
});

test("chat with citations", async ({ page }) => {
  await page.goto("/console?path=eu.DE");
  await settled(page);
  const assistant = await ask(
    page,
    "Why did Germany's revenue dip in March 2026?",
  );
  await expect(assistant.getByText("High confidence")).toBeVisible();
  await assistant
    .getByRole("button", { name: "DE · Mar 2026 · Revenue" })
    .focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.screenshot({ path: `${OUT}/chat-citations.png` });
});

test("low confidence", async ({ page }) => {
  await page.goto("/console");
  await settled(page);
  const assistant = await ask(
    page,
    "Is Cirrus underperforming everywhere or just in some markets?",
  );
  await expect(assistant.getByText("Low confidence")).toBeVisible();
  await page.screenshot({ path: `${OUT}/low-confidence.png` });
});

test("abstention", async ({ page }) => {
  await page.goto("/console");
  await settled(page);
  const assistant = await ask(page, "What will revenue be in Q1 2027?");
  await expect(assistant.getByText("This isn't in the data")).toBeVisible();
  await page.screenshot({ path: `${OUT}/abstention.png` });
});

test("alert form", async ({ page }) => {
  await page.goto("/console?path=eu.DE");
  await settled(page);
  await page.getByRole("button", { name: "New alert" }).click();
  const dialog = page.getByRole("dialog", { name: "New alert rule" });
  await dialog.getByRole("button", { name: "Save rule" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await page.screenshot({ path: `${OUT}/alert-form.png` });
});
