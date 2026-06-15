import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.PLAYWRIGHT_WEB_PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev:web -- --hostname 127.0.0.1 --port ${webPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: process.env.CI
    ? [
        {
          name: "Desktop Chrome",
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "Desktop Chrome",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "Pixel 7",
          use: { ...devices["Pixel 7"] },
        },
        {
          name: "iPad Mini",
          use: { ...devices["iPad Mini"] },
        },
      ],
});
