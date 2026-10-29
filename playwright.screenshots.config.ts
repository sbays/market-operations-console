import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/** README screenshots only: one desktop browser, a fixed window, the same production server. */
export default defineConfig({
  ...base,
  testDir: "./e2e/screenshots",
  testIgnore: [],
  retries: 0,
  projects: [
    {
      name: "screenshots",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
