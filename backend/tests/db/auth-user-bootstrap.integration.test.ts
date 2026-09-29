import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Auth user bootstrap trigger (real PostgreSQL)', () => {
  const schema = `auth_bootstrap_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let linkedUserId: string;
  let backfillUserId: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 2, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY, email varchar(255), raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb)`);
    const initialSchema = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initialSchema.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));

    linkedUserId = randomUUID();
    backfillUserId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id,email) VALUES ($1,$2),($3,$4)`, [linkedUserId, 'linked@example.test', backfillUserId, 'backfill@example.test']);
    await pool.query(`INSERT INTO ${schema}.app_users (user_id,email,role,status) VALUES ($1,$2,'SELLER','LOCKED')`, [linkedUserId, 'old-linked@example.test']);

    const migration = await readFile(new URL('../../prisma/migrations/20260929120000_auth_user_bootstrap/migration.sql', import.meta.url), 'utf8');
    const isolatedMigration = migration
      .replaceAll('public.app_users', `${schema}.app_users`)
      .replaceAll('auth.users', `${schema}.auth_users`)
      .replaceAll('public.handle_new_auth_user', `${schema}.handle_new_auth_user`)
      .replaceAll('public.', `${schema}.`);
    await pool.query(isolatedMigration);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 20_000);

  it('creates an active Buyer for a new Auth user and ignores privileged metadata', async () => {
    const userId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id,email,raw_user_meta_data) VALUES ($1,$2,$3)`, [userId, 'bootstrap@example.test', { role: 'ADMIN' }]);
    const result = await pool.query(`SELECT user_id,email,role,status FROM ${schema}.app_users WHERE user_id=$1`, [userId]);
    expect(result.rows).toEqual([{ user_id: userId, email: 'bootstrap@example.test', role: 'BUYER', status: 'ACTIVE' }]);
  });

  it('backfills missing application users without changing an existing role or status', async () => {
    const backfilled = await pool.query(`SELECT user_id,email,role,status FROM ${schema}.app_users WHERE user_id=$1`, [backfillUserId]);
    expect(backfilled.rows).toEqual([{ user_id: backfillUserId, email: 'backfill@example.test', role: 'BUYER', status: 'ACTIVE' }]);
    const linked = await pool.query(`SELECT user_id,email,role,status FROM ${schema}.app_users WHERE user_id=$1`, [linkedUserId]);
    expect(linked.rows).toEqual([{ user_id: linkedUserId, email: 'linked@example.test', role: 'SELLER', status: 'LOCKED' }]);
  });

  it('rejects Auth users without a usable email and rolls back their insert', async () => {
    const userId = randomUUID();
    await expect(pool.query(`INSERT INTO ${schema}.auth_users (id,email) VALUES ($1,NULL)`, [userId])).rejects.toThrow();
    const result = await pool.query(`SELECT count(*)::int AS count FROM ${schema}.auth_users WHERE id=$1`, [userId]);
    expect(result.rows[0].count).toBe(0);
  });

  it('keeps Auth identity retries from creating duplicate application users', async () => {
    const userId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id,email) VALUES ($1,$2)`, [userId, 'retry@example.test']);
    await expect(pool.query(`INSERT INTO ${schema}.auth_users (id,email) VALUES ($1,$2)`, [userId, 'retry@example.test'])).rejects.toMatchObject({ code: '23505' });
    const result = await pool.query(`SELECT count(*)::int AS count FROM ${schema}.app_users WHERE user_id=$1`, [userId]);
    expect(result.rows[0].count).toBe(1);
  });

  it('makes all required app_users columns available from Auth fields or database defaults', async () => {
    const result = await pool.query<{ column_name: string; column_default: string | null }>(
      `SELECT column_name,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='app_users' AND is_nullable='NO'`,
      [schema],
    );
    const requiredWithoutDefault = result.rows.filter(column => column.column_default === null).map(column => column.column_name).sort();
    expect(requiredWithoutDefault).toEqual(['email', 'role', 'status', 'user_id']);
  });
});
