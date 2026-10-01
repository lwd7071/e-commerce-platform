import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { createFixtureCategory, createFixtureUser } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { PgCatalogHttpService } from '../../src/modules/catalog/services/pg-catalog-http.service.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin Category API & Catalog Visibility (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_cat_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;
  let adminId: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 4,
      connectionTimeoutMillis: 10_000,
      options: `-c search_path=${schema} -c statement_timeout=20000`,
      application_name: schema,
    });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));

    adminId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [adminId]);
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });

    const catalogService = new PgCatalogHttpService(pool);
    app = createApp({
      pool,
      catalog: catalogService,
      rateLimiter: false,
      auth: (req, _res, next) => {
        req.context = { user_id: adminId, role: 'ADMIN', request_id: req.requestId ?? 'admin-cat-pg' };
        next();
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  it('[ADMIN-05] creates root and child category, rejects 3-level hierarchy (RB-KN04) and cycle parent', async () => {
    // 1. Tạo root category
    const rootRes = await request(app)
      .post('/api/v1/admin/categories')
      .send({
        category_name: 'Đồ Điện Tử',
        description: 'Thiết bị điện tử chính hãng',
      })
      .expect(201);

    expect(rootRes.body.data).toMatchObject({
      category_name: 'Đồ Điện Tử',
      parent_category_id: null,
      status: 'ACTIVE',
    });
    const rootId = rootRes.body.data.category_id;

    // 2. Tạo subcategory (level 2)
    const childRes = await request(app)
      .post('/api/v1/admin/categories')
      .send({
        category_name: 'Điện thoại & Tablet',
        parent_id: rootId,
      })
      .expect(201);

    expect(childRes.body.data).toMatchObject({
      category_name: 'Điện thoại & Tablet',
      parent_category_id: rootId,
      status: 'ACTIVE',
    });
    const childId = childRes.body.data.category_id;

    // 3. Không cho tạo level 3 trỏ vào childId (RB-KN04)
    const level3Res = await request(app)
      .post('/api/v1/admin/categories')
      .send({
        category_name: 'Phụ kiện điện thoại',
        parent_id: childId,
      })
      .expect(422);

    expect(level3Res.body.error.message).toMatch(/cannot exceed 2 levels/i);

    // 4. Cycle check: Không cho update rootCategory trỏ parent vào chính nó
    const cycleRes = await request(app)
      .patch(`/api/v1/admin/categories/${rootId}`)
      .send({
        parent_id: rootId,
      })
      .expect(422);

    expect(cycleRes.body.error.message).toMatch(/own parent/i);
  });

  it('[ADMIN-05] deactivating category hides it from public catalog query', async () => {
    const activeCat = await createFixtureCategory(pool, { categoryName: 'Thời Trang Nam' });
    const hiddenCat = await createFixtureCategory(pool, { categoryName: 'Thời Trang Đã Tắt' });

    // Ban đầu cả 2 đều active
    let pubRes = await request(app).get('/api/v1/categories').expect(200);
    expect(pubRes.body.data.some((c: { category_id: string }) => c.category_id === hiddenCat.categoryId)).toBe(true);

    // Admin chuyển hiddenCat sang INACTIVE
    const statusRes = await request(app)
      .patch(`/api/v1/admin/categories/${hiddenCat.categoryId}/status`)
      .send({ status: 'INACTIVE' })
      .expect(200);

    expect(statusRes.body.data.status).toBe('INACTIVE');

    // Sau khi đổi status sang INACTIVE, public GET /categories không còn thấy hiddenCat
    pubRes = await request(app).get('/api/v1/categories').expect(200);
    expect(pubRes.body.data.some((c: { category_id: string }) => c.category_id === hiddenCat.categoryId)).toBe(false);
    expect(pubRes.body.data.some((c: { category_id: string }) => c.category_id === activeCat.categoryId)).toBe(true);

    // Nhưng Admin GET /admin/categories vẫn nhìn thấy đầy đủ (kể cả INACTIVE)
    const adminListRes = await request(app).get('/api/v1/admin/categories').expect(200);
    const foundAdmin = adminListRes.body.data.find((c: { category_id: string }) => c.category_id === hiddenCat.categoryId);
    expect(foundAdmin).toBeTruthy();
    expect(foundAdmin.status).toBe('INACTIVE');
  });
});
