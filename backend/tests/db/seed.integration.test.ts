import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { withTransaction } from '../../db/transaction.js';
import { seedExistingAuthUser } from '../../db/seed/existing-auth-user.js';
import type { Pool } from 'pg';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;
let pool: Pool | undefined;

remoteDescribe('existing Auth user seed integration', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
    await pool.query(`
      CREATE TEMP TABLE pg_temp.p2_seed_probe (
        probe_id UUID PRIMARY KEY,
        marker TEXT NOT NULL
      ) ON COMMIT PRESERVE ROWS
    `);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP TABLE IF EXISTS pg_temp.p2_seed_probe');
      await closeDatabasePool(pool);
    }
  }, 20_000);

  it('rolls back parent work when auth FK validation fails', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    await expect(withTransaction(pool, async (client) => {
      await client.query("INSERT INTO pg_temp.p2_seed_probe (probe_id, marker) VALUES ('00000000-0000-4000-8000-000000000003', 'sentinel')");
      await seedExistingAuthUser(client, {
        userId: '22222222-2222-4222-8222-222222222222',
        email: 'seed-fk-failure@example.test',
        role: 'BUYER',
        status: 'ACTIVE',
        fullName: 'Seed FK Failure',
      });
    })).rejects.toMatchObject({ code: '23503' });
    const result = await pool.query('SELECT count(*)::int AS count FROM pg_temp.p2_seed_probe');
    expect(result.rows[0].count).toBe(0);
  }, 30_000);
});
