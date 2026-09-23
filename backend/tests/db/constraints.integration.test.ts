import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { withTransaction } from '../../db/transaction.js';
import {
  ensureAuthUser,
  createFixtureUser,
  createFixtureShop,
  createFixtureCategory,
  createFixtureProduct,
  createFixtureVariant,
  createFixtureAddress,
  createFixtureCart,
  createFixtureCartItem,
  createFixtureOrder,
  createFixtureOrderItem,
  createFixturePayment,
  createFixtureReview,
} from './fixtures/database-fixtures.js';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Direct Database Constraints & Delete Policies Integration (T2)', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  const makeTestUser = async (client: Pool | PoolClient, role: 'BUYER' | 'SELLER' | 'ADMIN') => {
    const id = randomUUID();
    const email = `test_${id.slice(0, 8)}@example.test`;
    await ensureAuthUser(client, id, email);
    return createFixtureUser(client, { userId: id, email, role });
  };

  describe('CHECK constraints enforcement (SQLSTATE 23514)', () => {
    it('[QD05] rejects product variant with price <= 0', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);

        await client.query('SAVEPOINT sp1');
        await expect(
          createFixtureVariant(client, prod.productId, { price: '0.00' }),
        ).rejects.toMatchObject({ code: '23514' });
        await client.query('ROLLBACK TO SAVEPOINT sp1');

        await client.query('SAVEPOINT sp2');
        await expect(
          createFixtureVariant(client, prod.productId, { price: '-50000.00' }),
        ).rejects.toMatchObject({ code: '23514' });
        await client.query('ROLLBACK TO SAVEPOINT sp2');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[QD06] rejects product variant with stock_quantity < 0', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);

        await expect(
          createFixtureVariant(client, prod.productId, { stockQuantity: -1 }),
        ).rejects.toMatchObject({ code: '23514' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-MG05] rejects cart_item with quantity < 1', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);
        const cart = await createFixtureCart(client, buyer.userId);

        await expect(
          createFixtureCartItem(client, cart.cartId, variant.variantId, { quantity: 0 }),
        ).rejects.toMatchObject({ code: '23514' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[QD15, RB-MG08] rejects reviews with rating outside 1..5', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);
        const order = await createFixtureOrder(client, buyer.userId, shop.shopId);
        const item = await createFixtureOrderItem(client, order.orderId, prod.productId, variant.variantId);

        await client.query('SAVEPOINT sp1');
        await expect(
          createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId, { rating: 0 }),
        ).rejects.toMatchObject({ code: '23514' });
        await client.query('ROLLBACK TO SAVEPOINT sp1');

        await client.query('SAVEPOINT sp2');
        await expect(
          createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId, { rating: 6 }),
        ).rejects.toMatchObject({ code: '23514' });
        await client.query('ROLLBACK TO SAVEPOINT sp2');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[QD10] rejects orders when total_amount does not equal subtotal + shipping_fee - discount_amount', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);

        await expect(
          createFixtureOrder(client, buyer.userId, shop.shopId, {
            subtotal: '100000.00',
            shippingFee: '20000.00',
            discountAmount: '10000.00',
            totalAmount: '999999.00', // expected: 110000.00
          }),
        ).rejects.toMatchObject({ code: '23514' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-LTT05] rejects PLATFORM voucher having shop_id', async () => {
      if (!pool) throw new Error('Pool not initialized');
      const voucherId = randomUUID();
      const dummyShopId = randomUUID();

      await withTransaction(pool, async (client) => {
        await expect(
          client.query(
            `INSERT INTO vouchers (
               voucher_id, code, voucher_name, scope, shop_id, discount_type,
               discount_value, min_order_value, quantity, start_at, end_at, status
             )
             VALUES (
               $1, 'BAD_PLATFORM_VOUCHER', 'Bad Platform',
               'PLATFORM', $2, 'FIXED',
               10000, 50000, 100, now(), now() + interval '1 day', 'ACTIVE'
             )`,
            [voucherId, dummyShopId],
          ),
        ).rejects.toMatchObject({ code: '23514' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-LTT05] rejects SHOP voucher without shop_id', async () => {
      if (!pool) throw new Error('Pool not initialized');
      const voucherId = randomUUID();

      await withTransaction(pool, async (client) => {
        await expect(
          client.query(
            `INSERT INTO vouchers (
               voucher_id, code, voucher_name, scope, shop_id, discount_type,
               discount_value, min_order_value, quantity, start_at, end_at, status
             )
             VALUES (
               $1, 'BAD_SHOP_VOUCHER', 'Bad Shop',
               'SHOP', NULL, 'FIXED',
               10000, 50000, 100, now(), now() + interval '1 day', 'ACTIVE'
             )`,
            [voucherId],
          ),
        ).rejects.toMatchObject({ code: '23514' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);
  });

  describe('UNIQUE & Partial UNIQUE index enforcement (SQLSTATE 23505)', () => {
    it('[RB-LB05] allows multiple default=false addresses but rejects two default=true addresses for the same user', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const user = await makeTestUser(client, 'BUYER');

        // Two non-default addresses: PASS
        await createFixtureAddress(client, user.userId, { isDefault: false });
        await createFixtureAddress(client, user.userId, { isDefault: false });

        // First default address: PASS
        await createFixtureAddress(client, user.userId, { isDefault: true });

        // Second default address for the same user: REJECT (23505)
        await expect(
          createFixtureAddress(client, user.userId, { isDefault: true }),
        ).rejects.toMatchObject({ code: '23505' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-LB10] allows multiple PENDING/FAILED payments but rejects two SUCCESS payments for the same order', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const order = await createFixtureOrder(client, buyer.userId, shop.shopId);

        // Multiple PENDING / FAILED payments: PASS
        await createFixturePayment(client, order.orderId, { status: 'PENDING' });
        await createFixturePayment(client, order.orderId, { status: 'FAILED' });

        // First SUCCESS payment: PASS
        await createFixturePayment(client, order.orderId, { status: 'SUCCESS' });

        // Second SUCCESS payment: REJECT (23505)
        await expect(
          createFixturePayment(client, order.orderId, { status: 'SUCCESS' }),
        ).rejects.toMatchObject({ code: '23505' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-MG05] rejects duplicate (cart_id, variant_id) in cart_items', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);
        const cart = await createFixtureCart(client, buyer.userId);

        await createFixtureCartItem(client, cart.cartId, variant.variantId, { quantity: 1 });

        // Second insert of same variant into same cart: REJECT (23505)
        await expect(
          createFixtureCartItem(client, cart.cartId, variant.variantId, { quantity: 2 }),
        ).rejects.toMatchObject({ code: '23505' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('[RB-LB09] rejects duplicate review on the same order_item_id', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);
        const order = await createFixtureOrder(client, buyer.userId, shop.shopId);
        const item = await createFixtureOrderItem(client, order.orderId, prod.productId, variant.variantId);

        await createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId, { rating: 5 });

        // Second review for same order_item: REJECT (23505)
        await expect(
          createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId, { rating: 4 }),
        ).rejects.toMatchObject({ code: '23505' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);
  });

  describe('Foreign Keys & Delete Policies (RESTRICT vs CASCADE)', () => {
    it('[QD16] ON DELETE RESTRICT blocks deleting app_users that has existing orders', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        await createFixtureOrder(client, buyer.userId, shop.shopId);

        // Attempting to delete user who has orders -> blocked by RESTRICT (23503)
        await expect(
          client.query('DELETE FROM app_users WHERE user_id = $1', [buyer.userId]),
        ).rejects.toMatchObject({ code: '23503' });

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('ON DELETE CASCADE automatically cascades deletion from carts to cart_items', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);
        const cart = await createFixtureCart(client, buyer.userId);
        const item = await createFixtureCartItem(client, cart.cartId, variant.variantId);

        // Delete cart
        await client.query('DELETE FROM carts WHERE cart_id = $1', [cart.cartId]);

        // Cart items should be automatically deleted (count = 0)
        const check = await client.query('SELECT count(*)::int AS count FROM cart_items WHERE cart_item_id = $1', [item.cartItemId]);
        expect(check.rows[0].count).toBe(0);

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);

    it('ON DELETE CASCADE automatically cascades deletion from products to product_images', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);

        // Insert product image
        const imgId = randomUUID();
        await client.query(
          `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
           VALUES ($1, $2, 'https://example.com/test.png', 0)`,
          [imgId, prod.productId],
        );

        // Delete product
        await client.query('DELETE FROM products WHERE product_id = $1', [prod.productId]);

        // Product image should be cascaded
        const check = await client.query('SELECT count(*)::int AS count FROM product_images WHERE image_id = $1', [imgId]);
        expect(check.rows[0].count).toBe(0);

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 25_000);
  });
});
