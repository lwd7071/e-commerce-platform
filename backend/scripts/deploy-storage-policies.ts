import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { assertStoragePolicyDeploymentAllowed } from '../db/storage-policy-safety.ts';

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
assertStoragePolicyDeploymentAllowed({
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  configuredProjectRef: process.env.SUPABASE_PROJECT_REF,
  allowStoragePolicyDeploy: process.env.ALLOW_STORAGE_POLICY_DEPLOY,
}, projectRef);

const sqlPath = fileURLToPath(new URL('../db/storage-policies.sql', import.meta.url));
const sql = await readFile(sqlPath, 'utf8');
const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 1 });
try {
  await pool.query(sql);
  process.stdout.write(`Storage policies applied to test project ${projectRef}.\n`);
} finally {
  await pool.end();
}
