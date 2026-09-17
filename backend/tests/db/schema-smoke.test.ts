import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { loadDatabaseConfig } from '../../db/config.js';

const expectedTables = [
  'app_users', 'user_profiles', 'addresses', 'shops', 'categories', 'products',
  'product_images', 'product_variants', 'carts', 'cart_items', 'orders',
  'order_items', 'order_status_history', 'payments', 'shipments', 'vouchers',
  'voucher_usages', 'reviews', 'review_images', 'notifications',
  'moderation_records', 'admin_logs',
];

const config = loadDatabaseConfig(process.env);
const client = new pg.Client({ connectionString: config.directUrl.toString() });

describe('Schema Freeze v1 Supabase smoke checks', () => {
  it('connects and exposes exactly the 22 business tables', async () => {
    await client.connect();
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations' order by table_name",
    );
    expect(result.rows.map((row) => row.table_name).sort()).toEqual([...expectedTables].sort());
  });

  it('enables RLS on every business table', async () => {
    const result = await client.query<{ count: string }>(
      "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) and c.relrowsecurity",
      [expectedTables],
    );
    expect(Number(result.rows[0].count)).toBe(expectedTables.length);
  });

  it('has an applied Prisma migration', async () => {
    const result = await client.query<{ applied: boolean }>(
      'select finished_at is not null as applied from _prisma_migrations order by started_at desc limit 1',
    );
    expect(result.rows[0]?.applied).toBe(true);
  });
});

afterAll(async () => {
  await client.end();
});
