import '../src/platform/config/load-root-env.ts';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabasePool } from '../db/client.ts';
import { loadDatabaseConfig } from '../db/config.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(__dirname, '../prisma/migrations/20261002140000_flash_sale_concurrency/migration.sql');

async function main() {
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const pool = createDatabasePool(loadDatabaseConfig(process.env));

  console.log('[Migration] Applying Flash Sale migration to PostgreSQL...');
  try {
    await pool.query(sql);
    console.log('✅ [Migration] Flash Sale migration applied successfully!');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('already exists')) {
      console.log('ℹ️ [Migration] Tables already exist, skipping.');
    } else {
      console.error('❌ [Migration] Error applying migration:', message);
      throw err;
    }
  } finally {
    await pool.end();
  }
}

main();
