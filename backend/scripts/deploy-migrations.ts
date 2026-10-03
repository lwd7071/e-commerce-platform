import '../src/platform/config/load-root-env.ts';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertMigrationDeploymentAllowed,
  migrationTargetPreview,
} from '../db/migration-safety.ts';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supabaseUrl = process.env.SUPABASE_URL;
const directUrl = process.env.DIRECT_URL;
if (!supabaseUrl || !directUrl) {
  throw new Error('Migration deploy requires SUPABASE_URL and DIRECT_URL in the root .env');
}

const target = migrationTargetPreview(new URL(supabaseUrl), new URL(directUrl));
const databaseUsername = decodeURIComponent(new URL(directUrl).username).split(':')[0];
const databaseProjectRef = databaseUsername.split('.').at(-1);
if (databaseProjectRef !== target.projectRef) {
  throw new Error('DIRECT_URL project credential does not match SUPABASE_URL project ref');
}

assertMigrationDeploymentAllowed({
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  allowMigrationDeploy: process.env.ALLOW_MIGRATION_DEPLOY,
}, target.projectRef);

process.stdout.write(
  `Deploying Prisma migrations to project ${target.projectRef} (${target.hostname}/${target.databaseName}).\n`,
);

const prismaEntry = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaEntry, 'migrate', 'deploy'], {
  cwd: backendRoot,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) throw result.error;
if (result.status === null) throw new Error('Prisma migration process did not return an exit status');
process.exitCode = result.status;
