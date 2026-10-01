import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { createFixtureCategory, createFixtureOrder, createFixtureProduct, createFixtureShop, createFixtureUser, createFixtureVariant } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin reporting API (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_report_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 4, connectionTimeoutMillis: 10_000, options: `-c search_path=${schema} -c statement_timeout=20000`, application_name: schema });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));

    const adminId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [adminId]);
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });
    app = createApp({ pool, rateLimiter: false, auth: (req, _res, next) => {
      req.context = { user_id: adminId, role: 'ADMIN', request_id: req.requestId ?? 'admin-report-pg' };
      next();
    } });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 30_000);

  it('[QD19] reports only completed-order GMV and uses inclusive Ho Chi Minh date bounds', async () => {
    const buyerId = randomUUID();
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1),($2)', [buyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId, role: 'BUYER' });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId, { productName: 'Report Item' });
    const variant = await createFixtureVariant(pool, product.productId);
    const completed = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'COMPLETED', subtotal: '100.00', shippingFee: '0.00', totalAmount: '100.00' });
    const cancelled = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'CANCELLED', subtotal: '900.00', shippingFee: '0.00', totalAmount: '900.00' });
    const nextLocalDay = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'CANCELLED', subtotal: '800.00', shippingFee: '0.00', totalAmount: '800.00' });
    await pool.query("UPDATE orders SET created_at='2026-10-01T16:59:59Z' WHERE order_id=$1", [completed.orderId]);
    await pool.query("UPDATE orders SET created_at='2026-10-01T12:00:00Z' WHERE order_id=$1", [cancelled.orderId]);
    await pool.query("UPDATE orders SET created_at='2026-10-01T17:00:00Z' WHERE order_id=$1", [nextLocalDay.orderId]);
    await pool.query("INSERT INTO order_items (order_item_id,order_id,product_id,variant_id,product_name_snapshot,unit_price,quantity,line_total) VALUES ($1,$2,$3,$4,'Report Item','100.00',1,'100.00')", [randomUUID(), completed.orderId, product.productId, variant.variantId]);

    const response = await request(app).get('/api/v1/admin/reports?from=2026-10-01&to=2026-10-01').expect(200);
    expect(response.body.data.dailyGmv).toEqual([{ date: '2026-10-01', orderCount: 2, gmv: '100.00' }]);
    expect(response.body.data.ordersByStatus).toEqual([{ status: 'CANCELLED', count: 1 }, { status: 'COMPLETED', count: 1 }]);
    expect(response.body.data.topShops[0]).toMatchObject({ name: shop.shopName, orderCount: 1, gmv: '100.00' });
    expect(response.body.data.topProducts[0]).toMatchObject({ name: 'Report Item', quantitySold: 1, gmv: '100.00' });
  });
});
