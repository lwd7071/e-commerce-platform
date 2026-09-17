import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import type { Pool } from 'pg';

const expectedTables = [
  'app_users', 'user_profiles', 'addresses', 'shops', 'categories', 'products',
  'product_images', 'product_variants', 'carts', 'cart_items', 'orders',
  'order_items', 'order_status_history', 'payments', 'shipments', 'vouchers',
  'voucher_usages', 'reviews', 'review_images', 'notifications',
  'moderation_records', 'admin_logs',
];
const supportTables = ['_prisma_migrations'];
const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;
let pool: Pool | undefined;

remoteDescribe('Schema Freeze v1 migration acceptance', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('has exactly the expected public business tables plus Prisma support', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    const result = await pool.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    );
    expect(result.rows.map((row) => row.table_name).sort()).toEqual([...expectedTables, ...supportTables].sort());
  }, 15_000);

  it('enables RLS and has no direct grants or policies on business tables', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    const rls = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ANY($1::text[]) AND c.relrowsecurity",
      [expectedTables],
    );
    expect(Number(rls.rows[0].count)).toBe(expectedTables.length);

    const grants = await pool.query(
      "SELECT table_name, grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema = 'public' AND table_name = ANY($1::text[]) AND grantee IN ('anon', 'authenticated', 'PUBLIC')",
      [expectedTables],
    );
    expect(grants.rows).toEqual([]);

    const policies = await pool.query(
      "SELECT tablename FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1::text[])",
      [expectedTables],
    );
    expect(policies.rows).toEqual([]);
  }, 15_000);

  it('has the required named keys, partial unique indexes and delete actions', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    const constraints = await pool.query<{ constraint_name: string }>(
      "SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public' AND constraint_name = ANY($1::text[])",
      [[
        'pk_app_users', 'pk_orders', 'pk_payments', 'pk_reviews',
        'uq_app_users__email', 'uq_carts__buyer_id', 'uq_vouchers__code',
        'uq_voucher_usages__order_id', 'uq_shipments__order_id',
        'uq_reviews__order_item_id', 'ck_product_variants__price_positive',
        'ck_product_variants__stock_nonnegative', 'ck_orders__total_formula',
        'ck_payments__success_paid_at', 'ck_vouchers__scope',
      ]],
    );
    expect(constraints.rows.map((row) => row.constraint_name).sort()).toEqual([
      'ck_orders__total_formula', 'ck_payments__success_paid_at', 'ck_product_variants__price_positive',
      'ck_product_variants__stock_nonnegative', 'ck_vouchers__scope', 'pk_app_users', 'pk_orders',
      'pk_payments', 'pk_reviews', 'uq_app_users__email', 'uq_carts__buyer_id', 'uq_reviews__order_item_id',
      'uq_shipments__order_id', 'uq_voucher_usages__order_id', 'uq_vouchers__code',
    ].sort());

    const indexes = await pool.query<{ indexname: string; indexdef: string }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[])",
      [['uq_addresses__one_default_per_user', 'uq_payments__one_success_per_order']],
    );
    expect(indexes.rows).toHaveLength(2);
    const normalizedIndex = (indexName: string): string =>
      (indexes.rows.find((row) => row.indexname === indexName)?.indexdef ?? '')
        .toLowerCase()
        .replace(/::[a-z_]+/g, '')
        .replace(/[()\s]/g, '');
    expect(normalizedIndex('uq_addresses__one_default_per_user')).toContain('whereis_default=true');
    expect(normalizedIndex('uq_payments__one_success_per_order')).toContain("wherestatus='success'");

    const deletes = await pool.query<{ constraint_name: string; delete_rule: string }>(
      "SELECT rc.constraint_name, rc.delete_rule FROM information_schema.referential_constraints rc WHERE rc.constraint_schema = 'public' AND rc.constraint_name = ANY($1::text[])",
      [['fk_product_images__product_id', 'fk_review_images__review_id', 'fk_cart_items__cart_id', 'fk_order_status_history__changed_by', 'fk_orders__buyer_id']],
    );
    const deleteRules = new Map(deletes.rows.map((row) => [row.constraint_name, row.delete_rule]));
    expect(deleteRules.get('fk_product_images__product_id')).toBe('CASCADE');
    expect(deleteRules.get('fk_review_images__review_id')).toBe('CASCADE');
    expect(deleteRules.get('fk_cart_items__cart_id')).toBe('CASCADE');
    expect(deleteRules.get('fk_order_status_history__changed_by')).toBe('SET NULL');
    expect(deleteRules.get('fk_orders__buyer_id')).toBe('RESTRICT');
  }, 15_000);

  it('has a finished migration record', async () => {
    if (!pool) throw new Error('Pool was not initialized');
    const result = await pool.query<{ applied: boolean }>(
      'SELECT finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY started_at DESC LIMIT 1',
    );
    expect(result.rows[0]?.applied).toBe(true);
  }, 15_000);
});
