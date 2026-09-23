import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';

const expectedTables = [
  'app_users', 'user_profiles', 'addresses', 'shops', 'categories', 'products',
  'product_images', 'product_variants', 'carts', 'cart_items', 'orders',
  'order_items', 'order_status_history', 'payments', 'shipments', 'vouchers',
  'voucher_usages', 'reviews', 'review_images', 'notifications',
  'moderation_records', 'admin_logs',
];

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('RLS Default-Deny Security Integration (T2)', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('confirms 100% of the 22 business tables have row-level security enabled', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const res = await pool.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
      [expectedTables],
    );

    expect(res.rows).toHaveLength(expectedTables.length);
    for (const row of res.rows) {
      expect(row.relrowsecurity).toBe(true);
    }
  }, 15_000);

  it('guarantees neither anon nor authenticated have direct table privileges on business tables', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const grants = await pool.query(
      `SELECT table_name, grantee, privilege_type
       FROM information_schema.table_privileges
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
         AND grantee IN ('anon', 'authenticated')`,
      [expectedTables],
    );

    expect(grants.rows).toEqual([]);
  }, 15_000);

  it('blocks direct queries when assuming the anon role (SQLSTATE 42501)', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE anon');

      // Attempting to select from private tables as anon must fail with 42501 (permission denied)
      await client.query('SAVEPOINT sp1');
      await expect(client.query('SELECT * FROM app_users LIMIT 1')).rejects.toMatchObject({
        code: '42501',
      });
      await client.query('ROLLBACK TO SAVEPOINT sp1');

      await client.query('SAVEPOINT sp2');
      await expect(client.query('SELECT * FROM orders LIMIT 1')).rejects.toMatchObject({
        code: '42501',
      });
      await client.query('ROLLBACK TO SAVEPOINT sp2');

      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }, 15_000);

  it('blocks direct queries when assuming the authenticated role (SQLSTATE 42501)', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE authenticated');

      // Attempting to select from private tables as authenticated must fail with 42501
      await client.query('SAVEPOINT sp1');
      await expect(client.query('SELECT * FROM app_users LIMIT 1')).rejects.toMatchObject({
        code: '42501',
      });
      await client.query('ROLLBACK TO SAVEPOINT sp1');

      await client.query('SAVEPOINT sp2');
      await expect(client.query('SELECT * FROM admin_logs LIMIT 1')).rejects.toMatchObject({
        code: '42501',
      });
      await client.query('ROLLBACK TO SAVEPOINT sp2');

      await client.query('ROLLBACK');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }, 15_000);
});
