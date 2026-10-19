import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Guided cross-account lessons include several reloads, screenshots and axe.
  // Keep individual assertions at 15s while allowing the complete journey 2min.
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3001",
    channel: "chrome",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:3001/api/session",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
