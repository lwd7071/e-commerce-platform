import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgOrderRepository } from '../../src/modules/order/repositories/pg-order.repository.ts';
import { OrderQueryService } from '../../src/modules/order/services/order-query.service.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { createFixtureUser, createFixtureShop, createFixtureCategory, createFixtureProduct, createFixtureVariant, createFixtureOrder, createFixtureOrderItem } from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import request from 'supertest';
import { createRuntimeApp } from '../../src/platform/http/app.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Runtime OrderQueryService (real PostgreSQL)', () => {
  const schema = `order_read_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: OrderQueryService;
  let buyerId: string;
  let otherBuyerId: string;
  let sellerId: string;
  let shopId: string;
  let orderId: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 6, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    service = new OrderQueryService(new PgOrderRepository(pool), pool);
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 30_000);

  async function seedOrder(buyer: string, shop: string, status: 'PENDING_CONFIRMATION' | 'CONFIRMED' = 'PENDING_CONFIRMATION') {
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop, category.categoryId, { productName: 'Áo khoác Snapshot' });
    const variant = await createFixtureVariant(pool, product.productId, { variantName: 'Size', sku: `SKU-${randomUUID()}`, price: '125000.50' });
    const order = await createFixtureOrder(pool, buyer, shop, { status, subtotal: '125000.50', shippingFee: '0.00', totalAmount: '125000.50' });
    const item = await createFixtureOrderItem(pool, order.orderId, product.productId, variant.variantId, { productName: 'Áo khoác Snapshot', unitPrice: '125000.50', lineTotal: '125000.50' });
    await pool.query(`UPDATE ${schema}.order_items SET variant_snapshot='Size M' WHERE order_item_id=$1`, [item.orderItemId]);
    await pool.query(`INSERT INTO ${schema}.product_images (image_id,product_id,image_url,sort_order) VALUES ($1,$2,$3,2),($4,$2,$5,0)`, [randomUUID(), product.productId, 'https://img.test/second.jpg', randomUUID(), 'https://img.test/primary.jpg']);
    return order.orderId;
  }

  beforeAll(async () => {
    buyerId = randomUUID(); otherBuyerId = randomUUID(); sellerId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1),($2),($3)`, [buyerId, otherBuyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId });
    await createFixtureUser(pool, { userId: otherBuyerId });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId, { shopName: 'Dino Shop', status: 'ACTIVE' });
    shopId = shop.shopId;
    orderId = await seedOrder(buyerId, shopId);
    await seedOrder(otherBuyerId, shopId, 'CONFIRMED');
  }, 60_000);

  it('returns real list and detail DTOs with batched items, shop/image and exact decimal strings', async () => {
    const buyer = createRequestContext({ request_id: 'req_test', user_id: buyerId, role: 'BUYER' });
    const list = await service.listOrders(buyer, { status: 'PENDING_CONFIRMATION' });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ order_id: orderId, buyer_id: buyerId, shop_id: shopId, shop_name: 'Dino Shop', subtotal: '125000.50', total_amount: '125000.50' });
    expect(list[0].items[0]).toMatchObject({ product_name: 'Áo khoác Snapshot', variant_name: 'Size M', unit_price: '125000.50', image_url: 'https://img.test/primary.jpg' });
    expect(await service.getOrderDetail(buyer, orderId)).toEqual(list[0]);
  });

  it('serves the read model through the HTTP runtime routes', async () => {
    const buyer = createRequestContext({ request_id: 'req_api', user_id: buyerId, role: 'BUYER' });
    const app = createApp({
      rateLimiter: false,
      auth: (req, _res, next) => { req.context = buyer; next(); },
      orderServices: { orderQueryService: service },
    });
    const list = await request(app).get('/api/v1/orders');
    expect(list.status).toBe(200);
    expect(list.body.data[0]).toMatchObject({ order_id: orderId, items: [{ product_name: 'Áo khoác Snapshot' }] });
    const detail = await request(app).get(`/api/v1/orders/${orderId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.order_id).toBe(orderId);
  });

  it('composes PostgreSQL order reads in createRuntimeApp and authenticates from app_users', async () => {
    const runtime = createRuntimeApp(process.env, {
      pool,
      tokenVerifier: { verifyToken: async () => ({ userId: buyerId }) },
    });
    const response = await request(runtime.app).get('/api/v1/orders').set('Authorization', 'Bearer integration-test-token');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ order_id: orderId, buyer_id: buyerId, items: [{ product_name: 'Áo khoác Snapshot' }] });
    await runtime.close();
  });

  it('scopes Buyer, Seller and Admin reads to their authorized records', async () => {
    const buyerA = createRequestContext({ request_id: 'req_a', user_id: buyerId, role: 'BUYER' });
    const buyerB = createRequestContext({ request_id: 'req_b', user_id: otherBuyerId, role: 'BUYER' });
    const seller = createRequestContext({ request_id: 'req_s', user_id: sellerId, role: 'SELLER', shop_id: shopId, shop_status: 'ACTIVE' });
    const admin = createRequestContext({ request_id: 'req_admin', user_id: randomUUID(), role: 'ADMIN' });
    expect(await service.getOrderDetail(buyerB, orderId)).toBeNull();
    expect((await service.listOrders(buyerA)).every(order => order.buyer_id === buyerId)).toBe(true);
    expect((await service.listOrders(seller)).every(order => order.shop_id === shopId)).toBe(true);
    expect(await service.listOrders(admin)).toHaveLength(2);
  });

  it('rejects invalid status filters and returns null for missing detail', async () => {
    const buyer = createRequestContext({ request_id: 'req_test', user_id: buyerId, role: 'BUYER' });
    await expect(service.listOrders(buyer, { status: 'UNKNOWN' as never })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await service.getOrderDetail(buyer, randomUUID())).toBeNull();
  });
});
