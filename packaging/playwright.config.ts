import { defineConfig, devices } from "@playwright/test";

// Run through `npm run test:packaging`, which packs the packages and sets MYIDII_PACKAGING_DIR.
export default defineConfig({
  testDir: ".",
  testMatch: "browser.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  outputDir: "../test-results",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [{ name: "chromium" }],
});
