import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { createFixtureUser, createFixtureShop, applyShippingMigration } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { SellerShopService } from '../../src/modules/shop/services/seller-shop.service.ts';
import { PgSellerShopRepository } from '../../src/modules/shop/repositories/pg-seller-shop.repository.ts';
import { ModerationService } from '../../src/modules/moderation/services/moderation.service.ts';
import { PgModerationTargetRepository } from '../../src/modules/moderation/repositories/pg-target.repository.ts';
import { PgAuditRepository } from '../../src/platform/audit/pg-audit.repository.ts';
import { PgTransactionManager } from '../../src/platform/database/pg-transaction-manager.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Seller Shop profile REST runtime (real PostgreSQL)', () => {
  const schema = `seller_shop_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let shopId: string;
  let sellerId: string;
  let adminId: string;
  let sellerApp: ReturnType<typeof createApp>;
  let adminApp: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 6, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    await applyShippingMigration(pool);
    sellerId = randomUUID(); adminId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1),($2)`, [sellerId, adminId]);
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });
    const shop = await createFixtureShop(pool, sellerId, { shopName: 'Pending Seller Shop', status: 'PENDING' });
    shopId = shop.shopId;
    const sellerContext = createRequestContext({ request_id: 'req_shop_seller', user_id: sellerId, role: 'SELLER', shop_id: shopId, shop_status: 'PENDING' });
    const adminContext = createRequestContext({ request_id: 'req_shop_admin', user_id: adminId, role: 'ADMIN' });
    const sellerShop = new SellerShopService(new PgSellerShopRepository(pool));
    const moderation = new ModerationService(new PgModerationTargetRepository(pool), new PgAuditRepository(pool), new PgTransactionManager(pool));
    sellerApp = createApp({ rateLimiter: false, auth: (req, _res, next) => { req.context = sellerContext; next(); }, sellerShop });
    adminApp = createApp({ rateLimiter: false, auth: (req, _res, next) => { req.context = adminContext; next(); }, moderation });
  }, 60_000);

  afterAll(async () => {
    if (pool) { try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); } finally { await pool.end(); } }
  }, 30_000);

  it('lets a pending Seller complete their own Shop profile and requires both fields before atomic Admin approval', async () => {
    const read = await request(sellerApp).get('/api/v1/seller/shop').expect(200);
    expect(read.body.data).toMatchObject({ shop_id: shopId, status: 'PENDING', pickup_address: null, contact_phone: null });

    await request(adminApp).post(`/api/v1/admin/shops/${shopId}/approve`).send({ reason: 'Review profile' }).expect(422);
    const stillPending = await request(sellerApp).get('/api/v1/seller/shop').expect(200);
    expect(stillPending.body.data.status).toBe('PENDING');

    await request(sellerApp).patch('/api/v1/seller/shop').send({ pickup_address: '12 Seller Lane', contact_phone: '0901234567' }).expect(200);
    await request(adminApp).post(`/api/v1/admin/shops/${shopId}/approve`).send({ reason: 'Profile verified' }).expect(200);
    const active = await request(sellerApp).get('/api/v1/seller/shop').expect(200);
    expect(active.body.data).toMatchObject({ status: 'ACTIVE', pickup_address: '12 Seller Lane', contact_phone: '0901234567' });
  });
});
