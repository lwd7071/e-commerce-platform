import { defineConfig } from "@playwright/test";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
  },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3000",
    cwd: __dirname,
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
