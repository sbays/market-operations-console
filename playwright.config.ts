import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  // README screenshots run separately (pnpm screenshots), never in CI.
  testIgnore: "screenshots/**",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    // CI has already run `pnpm build`; locally, build first so E2E always tests a production bundle.
    command: process.env.CI
      ? `pnpm start --port ${port}`
      : `pnpm build && pnpm start --port ${port}`,
    url: `http://127.0.0.1:${port}/console`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
