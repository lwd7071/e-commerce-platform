import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function findSpecFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findSpecFiles(fullPath));
    } else if (entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = findSpecFiles('test');
const userArgs = process.argv.slice(2);
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', ...userArgs, ...files], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
