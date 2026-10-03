import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgCatalogHttpService } from '../../src/modules/catalog/services/pg-catalog-http.service.ts';
import { createApp } from '../../src/platform/http/app.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Public categories runtime (real PostgreSQL)', () => {
  const schema = `category_runtime_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 4, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}; CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const sql = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    await pool.query(`
      INSERT INTO ${schema}.categories (category_id,parent_category_id,category_name,status) VALUES
      ('00000000-0000-0000-0000-000000000001',NULL,'Z root','ACTIVE'),
      ('00000000-0000-0000-0000-000000000002',NULL,'A root','ACTIVE'),
      ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Child','ACTIVE'),
      ('00000000-0000-0000-0000-000000000004',NULL,'Inactive','INACTIVE')
    `);
    app = createApp({ rateLimiter: false, catalog: new PgCatalogHttpService(pool) });
  }, 60_000);

  afterAll(async () => {
    if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await pool.end(); } }
  }, 30_000);

  it('serves a public flat ACTIVE category list with roots first and stable name order', async () => {
    const response = await request(app).get('/api/v1/categories');
    expect(response.status).toBe(200);
    expect(response.body.data.map((category: { category_name: string }) => category.category_name)).toEqual(['A root', 'Z root', 'Child']);
    expect(response.body.data.every((category: { category_name: string }) => category.category_name !== 'Inactive')).toBe(true);
    expect(response.body.data[0]).toMatchObject({ parent_category_id: null, category_name: 'A root' });
  });
});
