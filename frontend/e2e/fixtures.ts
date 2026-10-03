import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, test as base } from "@playwright/test";

const backendRoot = path.resolve(__dirname, "../../backend");
const resetScript = path.join(backendRoot, "scripts/reset-e2e-fixtures.ts");
const tsxCli = path.join(backendRoot, "node_modules/tsx/dist/cli.mjs");

type E2EFixtures = { resetDatabaseFixtures: void };

/** Import this test object in every browser spec so shared seeded data is reset first. */
export const test = base.extend<E2EFixtures>({
  resetDatabaseFixtures: [async ({}, use, testInfo) => {
    const reset = spawnSync(process.execPath, [tsxCli, resetScript], {
      cwd: backendRoot,
      env: process.env,
      encoding: "utf8",
      windowsHide: true,
      timeout: 110_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    if (reset.error || reset.status !== 0) {
      const details = [reset.error?.message, reset.stdout, reset.stderr].filter(Boolean).join("\n");
      throw new Error(`E2E fixture reset failed before ${testInfo.titlePath.join(" › ")}.\n${details}`);
    }

    await use();
  }, { auto: true, timeout: 115_000 }],
});

export { expect };
