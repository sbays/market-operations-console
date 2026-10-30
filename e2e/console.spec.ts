import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("root redirects to the console", async ({ page }) => {
  await page.goto("/");

  // The shown quarter is pinned into the URL, so a shared link never drifts.
  await expect(page).toHaveURL(/\/console\?period=2026-Q3$/);
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

  // Drill Europe › Germany first, as an analyst would before asking.
  await page
    .getByRole("table", { name: /Portfolio by region/ })
    .getByRole("button", { name: "Europe" })
    .click();
  await page
    .getByRole("table", { name: /Europe by market/ })
    .getByRole("button", { name: "Germany" })
    .click();
  await expect(page).toHaveURL(/\?period=2026-Q3&path=eu\.DE$/);

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
  await expect(page).toHaveURL(/\?period=2026-03&path=eu\.DE$/);
  // Focus lands on the figures that check the answer.
  const keyFigures = page.getByRole("region", { name: "Key figures" });
  await expect(keyFigures).toBeFocused();
  await expect(keyFigures).toContainText("Mar 2026");

  await page.goBack();
  await expect(page).toHaveURL(/\?period=2026-Q3&path=eu\.DE$/);
  await expect(keyFigures).toContainText("Q3 2026");
});

test("exec mode has no axe violations", async ({ page }) => {
  await page.goto("/console?path=eu&mode=exec");
  await expect(
    page.getByRole("button", { name: "Exec", pressed: true }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
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

  await expect(page).toHaveURL(/\?period=2026-Q3&path=eu\.DE$/);
  await expect(breadcrumb).toHaveText(/Portfolio.*Europe.*Germany/);
  await expect(
    page.getByRole("img", { name: /^Germany revenue, / }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);

  await page.goBack();
  await expect(page).toHaveURL(/\?period=2026-Q3&path=eu$/);
  await expect(breadcrumb.getByText("Europe")).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("a comparison survives a reload, because it lives in the URL", async ({
  page,
}) => {
  await page.goto("/console?path=eu");
  const table = page.getByRole("table", { name: /Europe by market/ });

  // The radar starts on the first four markets; swap three of them for Spain.
  for (const market of ["France", "United Kingdom", "Italy"]) {
    await table.getByRole("checkbox", { name: `Compare ${market}` }).uncheck();
  }
  await table.getByRole("checkbox", { name: "Compare Spain" }).check();
  await expect(page).toHaveURL(/compare=eu\.DE,eu\.ES/);

  await page.reload();

  const legend = page
    .getByRole("figure", { name: "Compare" })
    .getByRole("list", { name: "Legend" });
  await expect(legend.getByRole("listitem")).toHaveCount(2);
  await expect(legend).toContainText("Germany");
  await expect(legend).toContainText("Spain");
});

test("the alert dialog has no axe violations", async ({ page }) => {
  await page.goto("/console?path=eu.DE");
  await page.getByRole("button", { name: "New alert" }).click();
  const dialog = page.getByRole("dialog", { name: "New alert rule" });
  await expect(dialog.getByRole("checkbox", { name: "Germany" })).toBeChecked();
  // Scan after the zoom-in finishes: mid-animation, text is partly transparent and axe
  // measures a contrast the user never sees (this flaked on WebKit).
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  );

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a refused save rolls the alert rule back", async ({ page }) => {
  await page.goto("/console?path=eu.DE&fail=1");
  await page.getByRole("button", { name: "New alert" }).click();
  const dialog = page.getByRole("dialog", { name: "New alert rule" });
  await dialog.getByRole("textbox", { name: "Rule name" }).fill("Doomed");
  await dialog.getByRole("spinbutton", { name: "Threshold" }).fill("5");
  await dialog.getByRole("button", { name: "Save rule" }).click();

  // The optimistic "Saving…" row lives only until the refusal (about 600ms), too short to
  // assert reliably here (it flaked on WebKit); Alerts.test.tsx covers it with a held response.
  await expect(page.getByText("Couldn't save the alert rule.")).toBeVisible();
  await expect(page.getByText("Doomed")).toHaveCount(0);
});

test("the alert dialog scrolls to Save on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/console");
  await page.getByRole("button", { name: "New alert" }).click();
  const dialog = page.getByRole("dialog", { name: "New alert rule" });

  // Playwright scrolls the button into view before clicking; a clipped dialog can't be.
  await dialog.getByRole("button", { name: "Save rule" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Fix these before saving",
  );
});
