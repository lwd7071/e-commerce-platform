import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';

const expectedTables = [
  'app_users', 'user_profiles', 'addresses', 'shops', 'categories', 'products',
  'product_images', 'product_variants', 'carts', 'cart_items', 'orders',
  'order_items', 'order_status_history', 'payments', 'shipments', 'vouchers',
  'voucher_usages', 'reviews', 'review_images', 'notifications',
  'moderation_records', 'admin_logs',
  'admin_notification_campaigns', 'admin_notification_campaign_recipients',
];
const featureTables = [
  'chat_conversations', 'chat_messages',
  'flash_sale_sessions', 'flash_sale_items', 'flash_sale_compensation_logs',
  'shop_wallets', 'escrow_records', 'wallet_transactions', 'withdrawal_requests',
  'loyalty_point_transactions',
];
const operationalTables = ['api_idempotency_records', 'media_uploads'];

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
let client: pg.Client | undefined;

const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Schema Freeze v1 Supabase smoke checks', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    const candidate = new pg.Client({
      connectionString: config.directUrl.toString(),
      connectionTimeoutMillis: 30_000,
      query_timeout: 15_000,
    });
    try {
      await candidate.connect();
      client = candidate;
    } catch (error) {
      await candidate.end().catch(() => undefined);
      throw error;
    }
  }, 45_000);

  const requireConnectedClient = (): pg.Client => {
    if (!client) throw new Error('Remote database client was not connected.');
    return client;
  };

  afterAll(async () => {
    if (client) await client.end();
  }, 20_000);

  it('connects and exposes exactly the frozen and approved feature business tables', async () => {
    const result = await requireConnectedClient().query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> '_prisma_migrations' and table_name <> all($1::text[]) order by table_name",
      [operationalTables],
    );
    expect(result.rows.map((row) => row.table_name).sort()).toEqual([...expectedTables, ...featureTables].sort());
  }, 15_000);

  it('keeps operational tables separate and protected by RLS', async () => {
    const result = await requireConnectedClient().query<{ table_name: string; row_level_security: boolean }>(
      "select c.relname as table_name, c.relrowsecurity as row_level_security from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) order by c.relname",
      [operationalTables],
    );
    expect(result.rows).toEqual(operationalTables.slice().sort().map((table_name) => ({
      table_name,
      row_level_security: true,
    })));
  }, 15_000);

  it('enables RLS on every frozen and approved feature business table', async () => {
    const result = await requireConnectedClient().query<{ count: string }>(
      "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1::text[]) and c.relrowsecurity",
      [[...expectedTables, ...featureTables]],
    );
    expect(Number(result.rows[0].count)).toBe(expectedTables.length + featureTables.length);
  }, 15_000);

  it('has an applied Prisma migration', async () => {
    const result = await requireConnectedClient().query<{ applied: boolean }>(
      'select finished_at is not null as applied from _prisma_migrations order by started_at desc limit 1',
    );
    expect(result.rows[0]?.applied).toBe(true);
  }, 15_000);
});
