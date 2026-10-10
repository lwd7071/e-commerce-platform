import '../src/platform/config/load-root-env.ts';
import pg from 'pg';
import { loadDatabaseConfig } from '../db/config.ts';
import { seedDevelopmentCategories } from '../db/seed/development-categories.ts';
import { assertDevelopmentSeedAllowed } from '../db/seed/development-seed-safety.ts';

const config = loadDatabaseConfig(process.env);
const projectRef = config.supabaseUrl.hostname.split('.')[0];
assertDevelopmentSeedAllowed({
  nodeEnv: process.env.NODE_ENV,
  databaseEnvironment: process.env.DATABASE_ENVIRONMENT,
  expectedProjectRef: process.env.EXPECTED_SUPABASE_PROJECT_REF,
  allowDevelopmentSeed: process.env.ALLOW_DEVELOPMENT_CATEGORY_SEED,
}, projectRef);

const pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 1 });
try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedDevelopmentCategories(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  process.stdout.write(`Development categories are ready in Supabase project ${projectRef}.\n`);
} finally {
  await pool.end();
}
