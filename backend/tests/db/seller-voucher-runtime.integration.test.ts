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
import { SellerVoucherService } from '../../src/modules/voucher/services/seller-voucher.service.ts';
import { PgSellerVoucherRepository } from '../../src/modules/voucher/repositories/pg-seller-voucher.repository.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Seller Voucher runtime (real PostgreSQL)', () => {
  const schema = `seller_voucher_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let shopA: string; let sellerA: string; let shopB: string; let sellerB: string; let buyer: string;
  let appA: ReturnType<typeof createApp>; let appB: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 6, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    sellerA = randomUUID(); sellerB = randomUUID(); buyer = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1),($2),($3)`, [sellerA, sellerB, buyer]);
    await createFixtureUser(pool, { userId: sellerA, role: 'SELLER' });
    await createFixtureUser(pool, { userId: sellerB, role: 'SELLER' });
    await createFixtureUser(pool, { userId: buyer });
    shopA = (await createFixtureShop(pool, sellerA, { status: 'ACTIVE' })).shopId;
    shopB = (await createFixtureShop(pool, sellerB, { status: 'ACTIVE' })).shopId;
    const service = new SellerVoucherService(new PgSellerVoucherRepository(pool));
    const contextA = createRequestContext({ request_id: 'req_seller_a', user_id: sellerA, role: 'SELLER', shop_id: shopA, shop_status: 'ACTIVE' });
    const contextB = createRequestContext({ request_id: 'req_seller_b', user_id: sellerB, role: 'SELLER', shop_id: shopB, shop_status: 'ACTIVE' });
    appA = createApp({ rateLimiter: false, auth: (req, _res, next) => { req.context = contextA; next(); }, sellerVouchers: service });
    appB = createApp({ rateLimiter: false, auth: (req, _res, next) => { req.context = contextB; next(); }, sellerVouchers: service });
  }, 60_000);

  afterAll(async () => { if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await pool.end(); } } }, 30_000);

  it('scopes vouchers to one Shop and only allows used vouchers to be deactivated', async () => {
    const payload = { code: `S${randomUUID().slice(0, 8)}`, voucher_name: 'Shop promo', discount_type: 'PERCENT', discount_value: '10.00', max_discount: '50000.00', min_order_value: '100000.00', quantity: 5, start_at: '2026-10-01T00:00:00.000Z', end_at: '2026-12-01T00:00:00.000Z' };
    const created = await request(appA).post('/api/v1/seller/vouchers').send(payload).expect(201);
    const voucherId = created.body.data.voucher_id as string;
    expect(created.body.data).toMatchObject({ scope: 'SHOP', shop_id: shopA, code: payload.code.toUpperCase() });
    await request(appB).get(`/api/v1/seller/vouchers/${voucherId}`).expect(404);

    const order = await createFixtureOrder(pool, buyer, shopA);
    await pool.query(`INSERT INTO ${schema}.voucher_usages (usage_id,voucher_id,order_id,buyer_id,discount_amount) VALUES ($1,$2,$3,$4,10000)`, [randomUUID(), voucherId, order.orderId, buyer]);

    await request(appA).patch(`/api/v1/seller/vouchers/${voucherId}`).send({ voucher_name: 'Changed terms' }).expect(409);
    const disabled = await request(appA).patch(`/api/v1/seller/vouchers/${voucherId}/status`).send({ status: 'INACTIVE' }).expect(200);
    expect(disabled.body.data.status).toBe('INACTIVE');
  });
});
