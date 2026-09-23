import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

const expectedT2Indexes = [
  'idx_cart_items__cart_id__created_at',
  'idx_vouchers__active_listing',
  'idx_reviews__product_visible',
  'idx_addresses__user_id__default',
  'idx_products__shop_id__status',
  'idx_products__category_id__status',
  'idx_product_variants__product_id__status',
];

remoteDescribe('T2 Performance Indexes Acceptance Integration', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });

    // Apply T2 migration SQL to database idempotently
    const migrationPath = path.resolve(__dirname, '../../prisma/migrations/20260922120000_t2_performance_indexes/migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(sql);
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('confirms all 7 T2 performance indexes are successfully created in public schema', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const result = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = ANY($1::text[])`,
      [expectedT2Indexes],
    );

    const foundIndexes = result.rows.map((r) => r.indexname);
    for (const expected of expectedT2Indexes) {
      expect(foundIndexes).toContain(expected);
    }
  }, 15_000);

  it('validates partial index predicates for vouchers and reviews', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const result = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN ('idx_vouchers__active_listing', 'idx_reviews__product_visible')`,
    );

    const normalize = (def: string): string =>
      def.toLowerCase().replace(/::[a-z_]+/g, '').replace(/[()\s]/g, '');

    const voucherIndex = result.rows.find((r) => r.indexname === 'idx_vouchers__active_listing');
    expect(voucherIndex).toBeDefined();
    expect(normalize(voucherIndex!.indexdef)).toContain("wherestatus='active'andquantity>0");

    const reviewIndex = result.rows.find((r) => r.indexname === 'idx_reviews__product_visible');
    expect(reviewIndex).toBeDefined();
    expect(normalize(reviewIndex!.indexdef)).toContain("wherestatus='visible'");
  }, 15_000);

  it('verifies EXPLAIN query plan can reference active vouchers index', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const explain = await pool.query<{ 'QUERY PLAN': string }>(
      `EXPLAIN SELECT * FROM vouchers
       WHERE status = 'ACTIVE' AND quantity > 0 AND scope = 'PLATFORM'`,
    );

    const plan = explain.rows.map((r) => r['QUERY PLAN']).join('\n');
    expect(plan.length).toBeGreaterThan(0);
  }, 15_000);
});
