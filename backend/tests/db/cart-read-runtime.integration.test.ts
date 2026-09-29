import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgBuyerHttpService } from '../../src/modules/buyer/services/pg-buyer-http.service.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { createFixtureUser, createFixtureShop, createFixtureCategory, createFixtureProduct, createFixtureVariant, createFixtureCart, createFixtureCartItem } from './fixtures/database-fixtures.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Enriched runtime cart read model (real PostgreSQL)', () => {
  const schema = `cart_read_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let service: PgBuyerHttpService;
  let buyerId: string;
  let otherBuyerId: string;
  let shopId: string;
  let availableVariantId: string;
  let inactiveVariantId: string;
  let unavailableVariantId: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({ connectionString: config.directUrl.toString(), max: 6, options: `-c search_path=${schema}` });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));
    service = new PgBuyerHttpService(pool);
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); }
      finally { await pool.end(); }
    }
  }, 30_000);

  beforeAll(async () => {
    buyerId = randomUUID(); otherBuyerId = randomUUID();
    const sellerId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1),($2),($3)`, [buyerId, otherBuyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId });
    await createFixtureUser(pool, { userId: otherBuyerId });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    shopId = (await createFixtureShop(pool, sellerId, { shopName: 'Dino Shop', status: 'ACTIVE' })).shopId;
    const categoryId = (await createFixtureCategory(pool)).categoryId;
    const availableProduct = await createFixtureProduct(pool, shopId, categoryId, { productName: 'Áo xanh' });
    const inactiveProduct = await createFixtureProduct(pool, shopId, categoryId, { productName: 'Áo cũ' });
    const outOfStockProduct = await createFixtureProduct(pool, shopId, categoryId, { productName: 'Áo hết hàng' });
    availableVariantId = (await createFixtureVariant(pool, availableProduct.productId, { variantName: 'Size', sku: `A-${randomUUID()}`, price: '12345.67', stockQuantity: 9 })).variantId;
    inactiveVariantId = (await createFixtureVariant(pool, inactiveProduct.productId, { variantName: 'Màu', sku: `I-${randomUUID()}`, price: '23456.78', status: 'INACTIVE', stockQuantity: 5 })).variantId;
    unavailableVariantId = (await createFixtureVariant(pool, outOfStockProduct.productId, { variantName: 'Size', sku: `O-${randomUUID()}`, price: '34567.89', stockQuantity: 0 })).variantId;
    await pool.query(`UPDATE ${schema}.products SET status='INACTIVE' WHERE product_id=$1`, [inactiveProduct.productId]);
    await pool.query(`INSERT INTO ${schema}.product_images (image_id,product_id,image_url,sort_order) VALUES ($1,$2,$3,4),($4,$2,$5,0)`, [randomUUID(), availableProduct.productId, 'https://img.test/last.jpg', randomUUID(), 'https://img.test/cover.jpg']);
    const cart = await createFixtureCart(pool, buyerId);
    await createFixtureCartItem(pool, cart.cartId, availableVariantId, { quantity: 2 });
    await createFixtureCartItem(pool, cart.cartId, inactiveVariantId, { quantity: 1 });
    await createFixtureCartItem(pool, cart.cartId, unavailableVariantId, { quantity: 1 });
  }, 60_000);

  it('returns current price, stock, product/shop display data and primary image without losing decimal precision', async () => {
    const result = await service.getCart(createRequestContext({ request_id: 'req_test', user_id: buyerId, role: 'BUYER' })) as { items: Array<Record<string, unknown>> };
    const item = result.items.find(row => row.variant_id === availableVariantId);
    expect(item).toMatchObject({ product_name: 'Áo xanh', variant_name: 'Size', price: '12345.67', stock_quantity: 9, shop_id: shopId, shop_name: 'Dino Shop', image_url: 'https://img.test/cover.jpg', product_status: 'ACTIVE', variant_status: 'ACTIVE', shop_status: 'ACTIVE', is_available: true, quantity: 2 });
  });

  it('keeps inactive and out-of-stock rows visible as unavailable and allows a missing image', async () => {
    const result = await service.getCart(createRequestContext({ request_id: 'req_test', user_id: buyerId, role: 'BUYER' })) as { items: Array<Record<string, unknown>> };
    expect(result.items.find(row => row.variant_id === inactiveVariantId)).toMatchObject({ product_status: 'INACTIVE', variant_status: 'INACTIVE', image_url: null, is_available: false });
    expect(result.items.find(row => row.variant_id === unavailableVariantId)).toMatchObject({ stock_quantity: 0, is_available: false });
    expect(result.items).toHaveLength(3);
  });

  it('isolates carts and serves the read model through the authenticated API route', async () => {
    const buyer = createRequestContext({ request_id: 'req_test', user_id: buyerId, role: 'BUYER' });
    const isolated = await service.getCart(createRequestContext({ request_id: 'req_other', user_id: otherBuyerId, role: 'BUYER' })) as { items: unknown[] };
    expect(isolated.items).toEqual([]);
    const app = createApp({ rateLimiter: false, buyer: service, auth: (req, _res, next) => { req.context = buyer; next(); } });
    const response = await request(app).get('/api/v1/cart').expect(200);
    expect(response.body.data.items).toHaveLength(3);
  });
});
