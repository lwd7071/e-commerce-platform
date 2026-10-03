import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';

// A release-gate invocation must fail without a database, never pass by skipping.
const result = spawnSync(process.execPath, [
  fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)),
  'run', 'tests/db/pg-checkout.integration.test.ts', ...process.argv.slice(2),
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, RUN_REMOTE_DB_TESTS: 'true' },
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
