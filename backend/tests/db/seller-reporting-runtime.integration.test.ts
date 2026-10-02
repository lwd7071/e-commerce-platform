import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { createFixtureUser, createFixtureShop, createFixtureOrder } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { PgOrderRepository } from '../../src/modules/order/repositories/pg-order.repository.ts';
import { ReportingService } from '../../src/modules/reporting/services/reporting.service.ts';
import { SellerRevenueService } from '../../src/modules/reporting/services/seller-revenue.service.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Seller revenue report REST runtime (real PostgreSQL)', () => {
  const schema = `seller_report_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let appA: ReturnType<typeof createApp>;
  let shopA: string;
  let shopB: string;
  let buyer: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 5, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const migration = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(migration.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    const sellerA = randomUUID(); const sellerB = randomUUID(); buyer = randomUUID();
    await pool.query('INSERT INTO auth_users(id) VALUES ($1),($2),($3)', [sellerA, sellerB, buyer]);
    await createFixtureUser(pool, { userId: sellerA, role: 'SELLER' });
    await createFixtureUser(pool, { userId: sellerB, role: 'SELLER' });
    await createFixtureUser(pool, { userId: buyer, role: 'BUYER' });
    shopA = (await createFixtureShop(pool, sellerA, { shopName: 'Report A', status: 'ACTIVE' })).shopId;
    shopB = (await createFixtureShop(pool, sellerB, { shopName: 'Report B', status: 'ACTIVE' })).shopId;
    const completedA = await createFixtureOrder(pool, buyer, shopA, { status: 'COMPLETED', subtotal: '100000.00', shippingFee: '20000.00', totalAmount: '120000.00' });
    const pendingA = await createFixtureOrder(pool, buyer, shopA, { status: 'PENDING_CONFIRMATION' });
    await createFixtureOrder(pool, buyer, shopB, { status: 'COMPLETED', subtotal: '900000.00', shippingFee: '0.00', totalAmount: '900000.00' });
    await pool.query('UPDATE orders SET created_at = $1 WHERE order_id = $2', [
      '2026-10-01T12:00:00.000Z', completedA.orderId,
    ]);
    await pool.query('UPDATE orders SET created_at = $1 WHERE order_id = $2', [
      '2026-10-01T13:00:00.000Z', pendingA.orderId,
    ]);
    const context = createRequestContext({ request_id: 'req_report_seller', user_id: sellerA, role: 'SELLER', shop_id: shopA, shop_status: 'ACTIVE' });
    const revenue = new SellerRevenueService(new ReportingService({ orderRepo: new PgOrderRepository(pool) }));
    appA = createApp({ rateLimiter: false, auth: (req, _res, next) => { req.context = context; next(); }, sellerRevenue: revenue });
  }, 60_000);

  afterAll(async () => { if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await pool.end(); } } }, 30_000);

  it('counts only completed orders for the authenticated Shop and applies inclusive date filters', async () => {
    const response = await request(appA).get('/api/v1/seller/reports/revenue?from=2026-10-01T00:00:00.000Z&to=2026-10-01T23:59:59.999Z').expect(200);
    expect(response.body.data).toMatchObject({ shopId: shopA, totalOrders: 2, completedOrders: 1, grossRevenue: '120000.00' });
    await request(appA).get('/api/v1/seller/reports/revenue?from=2026-10-02T00:00:00.000Z&to=2026-10-03T00:00:00.000Z')
      .expect(200).expect((res) => expect(res.body.data.grossRevenue).toBe('0.00'));
  });
});
