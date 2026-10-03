import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { withTransaction } from '../../db/transaction.js';
import type { Pool } from 'pg';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;
let pool: Pool | undefined;

remoteDescribe('database transaction integration', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 1 },
    });
    await pool.query(`
      CREATE TEMP TABLE pg_temp.p2_transaction_probe (
        probe_id UUID PRIMARY KEY,
        marker TEXT NOT NULL
      ) ON COMMIT PRESERVE ROWS
    `);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP TABLE IF EXISTS pg_temp.p2_transaction_probe');
      await closeDatabasePool(pool);
    }
  }, 20_000);

  it('commits a row in the pg_temp probe', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    await withTransaction(pool, async (client) => {
      await client.query("INSERT INTO pg_temp.p2_transaction_probe (probe_id, marker) VALUES ('00000000-0000-4000-8000-000000000001', 'commit')");
    });
    const result = await pool.query('SELECT count(*)::int AS count FROM pg_temp.p2_transaction_probe');
    expect(result.rows[0].count).toBe(1);
  }, 30_000);

  it('rolls back the row and leaves the temp probe clean', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    await pool.query('TRUNCATE pg_temp.p2_transaction_probe');
    await expect(withTransaction(pool, async (client) => {
      await client.query("INSERT INTO pg_temp.p2_transaction_probe (probe_id, marker) VALUES ('00000000-0000-4000-8000-000000000002', 'rollback')");
      throw new Error('intentional rollback probe');
    })).rejects.toThrow('intentional rollback probe');
    const result = await pool.query('SELECT count(*)::int AS count FROM pg_temp.p2_transaction_probe');
    expect(result.rows[0].count).toBe(0);
  }, 30_000);

  it('waits for a leased client when a max-one pool is occupied', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    let releaseFirst!: () => void;
    const firstReady = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstStarted!: () => void;
    const started = new Promise<void>((resolve) => { firstStarted = resolve; });

    const first = withTransaction(pool, async () => {
      firstStarted();
      await firstReady;
    });
    await started;

    let secondFinished = false;
    const second = withTransaction(pool, async () => undefined).then(() => { secondFinished = true; });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(secondFinished).toBe(false);

    releaseFirst();
    await Promise.all([first, second]);
    expect(secondFinished).toBe(true);
  }, 30_000);

  it('uses separate backend sessions for concurrent transactions when capacity is two', async () => {
    const config = loadDatabaseConfig(process.env);
    const concurrentPool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 2 },
    });
    try {
      const pids = await Promise.all([
        withTransaction(concurrentPool, async (client) => {
          const result = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
          await client.query('SELECT pg_sleep(0.2)');
          return result.rows[0].pid;
        }),
        withTransaction(concurrentPool, async (client) => {
          const result = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
          await client.query('SELECT pg_sleep(0.2)');
          return result.rows[0].pid;
        }),
      ]);
      expect(new Set(pids).size).toBe(2);
    } finally {
      await closeDatabasePool(concurrentPool);
    }
  }, 30_000);
});
