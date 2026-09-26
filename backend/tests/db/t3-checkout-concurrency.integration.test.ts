import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import {
  createFixtureAddress,
  createFixtureCart,
  createFixtureCartItem,
  createFixtureCategory,
  createFixtureProduct,
  createFixtureShop,
  createFixtureUser,
  createFixtureVariant,
  ensureAuthUser,
} from './fixtures/database-fixtures.js';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('PgCheckoutService PostgreSQL concurrency acceptance (T3)', () => {
  let pool: Pool | undefined;
  const fixtureUserIds: string[] = [];
  const fixtureShopIds: string[] = [];
  const fixtureCategoryIds: string[] = [];

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 6 } });
  }, 45_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM api_idempotency_records WHERE user_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM notifications WHERE recipient_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM payments WHERE order_id IN (SELECT order_id FROM orders WHERE buyer_id = ANY($1::uuid[]))', [fixtureUserIds]);
    await pool.query('DELETE FROM order_status_history WHERE order_id IN (SELECT order_id FROM orders WHERE buyer_id = ANY($1::uuid[]))', [fixtureUserIds]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT order_id FROM orders WHERE buyer_id = ANY($1::uuid[]))', [fixtureUserIds]);
    await pool.query('DELETE FROM orders WHERE buyer_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT cart_id FROM carts WHERE buyer_id = ANY($1::uuid[]))', [fixtureUserIds]);
    await pool.query('DELETE FROM carts WHERE buyer_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM addresses WHERE user_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM product_variants WHERE product_id IN (SELECT product_id FROM products WHERE shop_id = ANY($1::uuid[]))', [fixtureShopIds]);
    await pool.query('DELETE FROM products WHERE shop_id = ANY($1::uuid[])', [fixtureShopIds]);
    await pool.query('DELETE FROM shops WHERE shop_id = ANY($1::uuid[])', [fixtureShopIds]);
    await pool.query('DELETE FROM categories WHERE category_id = ANY($1::uuid[])', [fixtureCategoryIds]);
    await pool.query('DELETE FROM app_users WHERE user_id = ANY($1::uuid[])', [fixtureUserIds]);
    await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [fixtureUserIds]);
    await closeDatabasePool(pool);
  }, 30_000);

  it('allows exactly one of two buyers to purchase the final stock unit', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const createUser = async (role: 'BUYER' | 'SELLER') => {
      const userId = randomUUID();
      const email = `${role.toLowerCase()}_${userId.slice(0, 8)}@fixture.test`;
      await ensureAuthUser(pool!, userId, email);
      return createFixtureUser(pool!, { userId, email, role });
    };
    const seller = await createUser('SELLER');
    const buyerA = await createUser('BUYER');
    const buyerB = await createUser('BUYER');
    fixtureUserIds.push(seller.userId, buyerA.userId, buyerB.userId);

    const shop = await createFixtureShop(pool, seller.userId);
    fixtureShopIds.push(shop.shopId);
    const category = await createFixtureCategory(pool, { categoryName: `T3 checkout concurrency ${randomUUID()}` });
    fixtureCategoryIds.push(category.categoryId);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId);
    const variant = await createFixtureVariant(pool, product.productId, { stockQuantity: 1 });
    const addressA = await createFixtureAddress(pool, buyerA.userId);
    const addressB = await createFixtureAddress(pool, buyerB.userId);
    const cartA = await createFixtureCart(pool, buyerA.userId);
    const cartB = await createFixtureCart(pool, buyerB.userId);
    await createFixtureCartItem(pool, cartA.cartId, variant.variantId, { quantity: 1, isSelected: true });
    await createFixtureCartItem(pool, cartB.cartId, variant.variantId, { quantity: 1, isSelected: true });

    const service = new PgCheckoutService(pool, async () => {});
    const checkout = (buyerId: string, addressId: string) => service.createOrder(
      { request_id: randomUUID(), user_id: buyerId, role: 'BUYER' },
      { address_id: addressId, payment_method: 'COD', vouchers: [], idempotency_key: randomUUID() },
    );

    const results = await Promise.allSettled([
      checkout(buyerA.userId, addressA.addressId),
      checkout(buyerB.userId, addressB.addressId),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const stock = await pool.query<{ stock_quantity: number }>(
      'SELECT stock_quantity FROM product_variants WHERE variant_id = $1',
      [variant.variantId],
    );
    expect(Number(stock.rows[0].stock_quantity)).toBe(0);
  }, 45_000);
});
