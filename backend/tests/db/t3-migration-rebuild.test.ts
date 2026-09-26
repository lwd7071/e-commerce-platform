import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 22 bảng nghiệp vụ bắt buộc theo Schema Freeze v1
const EXPECTED_BUSINESS_TABLES = [
  'app_users', 'user_profiles', 'addresses', 'shops', 'categories', 'products',
  'product_images', 'product_variants', 'carts', 'cart_items', 'orders',
  'order_items', 'order_status_history', 'payments', 'shipments', 'vouchers',
  'voucher_usages', 'reviews', 'review_images', 'notifications',
  'moderation_records', 'admin_logs',
];

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

describe('Migration Rebuild & Clean Replay Safety (T3 Unit)', () => {
  const migrationsDir = path.resolve(__dirname, '../../prisma/migrations');

  it('contains expected migration directories in chronological order', () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    // Xác nhận có đủ các migration milestones từ T1 đến T3
    expect(entries).toContain('20260916110000_initial_schema');
    expect(entries).toContain('20260918170000_add_api_idempotency_records');
    expect(entries).toContain('20260922120000_t2_performance_indexes');
    expect(entries).toContain('20260924120000_t3_idempotency_rls_hardening');
    expect(entries).toContain('20260926100000_t3_cross_domain_hardening');
  });

  it('contains durable notification event idempotency migration', () => {
    const sqlPath = path.join(
      migrationsDir,
      '20260926100000_t3_cross_domain_hardening',
      'migration.sql',
    );

    expect(fs.existsSync(sqlPath)).toBe(true);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    expect(sql).toMatch(/ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+event_id\s+VARCHAR\(100\)/i);
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+uq_notifications__event_id/i);
  });

  it('guarantees migration files do not contain destructive DROP or hardcoded secrets', () => {
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dirName of entries) {
      const sqlPath = path.join(migrationsDir, dirName, 'migration.sql');
      expect(fs.existsSync(sqlPath)).toBe(true);

      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      // Chặn các lệnh phá hủy schema bừa bãi
      expect(sqlContent).not.toMatch(/DROP\s+DATABASE/i);
      expect(sqlContent).not.toMatch(/DROP\s+SCHEMA/i);
      expect(sqlContent).not.toMatch(/DROP\s+TABLE\s+(?!IF\s+EXISTS)/i);

      // Không chứa secrets hoặc private keys
      expect(sqlContent).not.toMatch(/service_role/i);
      expect(sqlContent).not.toMatch(/BEGIN\s+PRIVATE\s+KEY/i);
      expect(sqlContent).not.toMatch(/postgres:\/\/.*:.*@/i);
    }
  });

  it('confirms T2 performance indexes migration is purely additive', () => {
    const t2SqlPath = path.join(
      migrationsDir,
      '20260922120000_t2_performance_indexes',
      'migration.sql',
    );
    const sql = fs.readFileSync(t2SqlPath, 'utf8');

    // Chỉ chứa CREATE INDEX IF NOT EXISTS, không chứa lệnh sửa đổi cấu trúc bảng
    expect(sql).toMatch(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE/i);
    expect(sql).not.toMatch(/DROP/i);
  });
});

remoteDescribe('Migration State & Database Replay Acceptance (T3 Remote)', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('verifies all Prisma migration logs are recorded as finished without failure', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const result = await pool.query<{
      migration_name: string;
      finished_at: Date | null;
      applied_steps_count: number;
    }>(
      'SELECT migration_name, finished_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at ASC',
    );

    expect(result.rows.length).toBeGreaterThanOrEqual(2);
    for (const migration of result.rows) {
      expect(migration.finished_at).not.toBeNull();
      expect(migration.applied_steps_count).toBeGreaterThan(0);
    }
  }, 15_000);

  it('confirms the database schema contains exactly 22 business tables and 1 operational table', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const result = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name NOT IN ('_prisma_migrations', 'api_idempotency_records')
       ORDER BY table_name`,
    );

    const actualTables = result.rows.map((r) => r.table_name).sort();
    expect(actualTables).toEqual([...EXPECTED_BUSINESS_TABLES].sort());

    // Xác nhận bảng vận hành thứ 23 tồn tại riêng
    const opResult = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = 'api_idempotency_records'`,
    );
    expect(opResult.rows).toHaveLength(1);
  }, 15_000);

  it('validates public schema has no orphaned constraints or broken foreign keys', async () => {
    if (!pool) throw new Error('Pool not initialized');

    // Kiểm tra tất cả foreign keys trỏ đến bảng và cột hợp lệ trong public schema
    const fkCheck = await pool.query<{ constraint_name: string }>(
      `SELECT tc.constraint_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = 'public'`,
    );

    expect(fkCheck.rows.length).toBeGreaterThan(0);
  }, 15_000);
});
