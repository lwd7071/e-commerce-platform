import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "mobile-role-layout.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 300_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://127.0.0.1:3011", trace: "retain-on-failure" },
  webServer: {
    command: "npx next dev --webpack --hostname 127.0.0.1 --port 3011",
    cwd: __dirname,
    url: "http://127.0.0.1:3011",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
