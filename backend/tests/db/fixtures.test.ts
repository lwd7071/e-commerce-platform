import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
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
  createFixtureVoucher,
  createFixtureOrder,
  createFixtureOrderItem,
  createFixturePayment,
  createFixtureReview,
} from './fixtures/database-fixtures.js';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Database Fixtures Platform', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  it('creates an end-to-end fixture hierarchy in a transaction and rolls back safely', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const testBuyerId = '00000000-0000-4000-f000-000000000001';
    const testSellerId = '00000000-0000-4000-f000-000000000002';

    await withTransaction(pool, async (client) => {
      // 1. Users
      await ensureAuthUser(client, testBuyerId, 'fixture-buyer@example.test');
      await ensureAuthUser(client, testSellerId, 'fixture-seller@example.test');

      const buyer = await createFixtureUser(client, { userId: testBuyerId, email: 'fixture-buyer@example.test', role: 'BUYER' });
      expect(buyer.userId).toBe(testBuyerId);

      const seller = await createFixtureUser(client, { userId: testSellerId, email: 'fixture-seller@example.test', role: 'SELLER' });
      expect(seller.userId).toBe(testSellerId);

      // 2. Shop & Category
      const shop = await createFixtureShop(client, seller.userId, { shopName: 'Fixture Test Shop' });
      expect(shop.ownerId).toBe(seller.userId);

      const category = await createFixtureCategory(client, { categoryName: 'Fixture Test Category' });
      expect(category.categoryName).toBe('Fixture Test Category');

      // 3. Product & Variant
      const product = await createFixtureProduct(client, shop.shopId, category.categoryId, { productName: 'Fixture Test Product' });
      expect(product.shopId).toBe(shop.shopId);

      const variant = await createFixtureVariant(client, product.productId, { price: '120000.00', stockQuantity: 50 });
      expect(variant.productId).toBe(product.productId);

      // 4. Address & Cart
      const address = await createFixtureAddress(client, buyer.userId, { isDefault: true });
      expect(address.userId).toBe(buyer.userId);
      expect(address.isDefault).toBe(true);

      const cart = await createFixtureCart(client, buyer.userId);
      expect(cart.buyerId).toBe(buyer.userId);

      const cartItem = await createFixtureCartItem(client, cart.cartId, variant.variantId, { quantity: 2 });
      expect(cartItem.cartId).toBe(cart.cartId);

      // 5. Voucher
      const voucher = await createFixtureVoucher(client, { code: 'FIXTURE10' });
      expect(voucher.code).toBe('FIXTURE10');

      // 6. Order & OrderItem
      const order = await createFixtureOrder(client, buyer.userId, shop.shopId, {
        subtotal: '240000.00',
        shippingFee: '20000.00',
        discountAmount: '0.00',
        totalAmount: '260000.00',
      });
      expect(order.buyerId).toBe(buyer.userId);

      const orderItem = await createFixtureOrderItem(client, order.orderId, product.productId, variant.variantId, {
        unitPrice: '120000.00',
        quantity: 2,
        lineTotal: '240000.00',
      });
      expect(orderItem.orderId).toBe(order.orderId);

      // 7. Payment & Review
      const payment = await createFixturePayment(client, order.orderId, { amount: '260000.00', status: 'PENDING' });
      expect(payment.orderId).toBe(order.orderId);

      const review = await createFixtureReview(client, buyer.userId, product.productId, orderItem.orderItemId, { rating: 5 });
      expect(review.rating).toBe(5);

      // Trigger rollback so no test data remains
      throw new Error('ROLLBACK_INTENTIONAL');
    }).catch((err) => {
      if (err.message !== 'ROLLBACK_INTENTIONAL') throw err;
    });

    // Verify database remains clean
    const check = await pool.query('SELECT count(*)::int AS count FROM app_users WHERE user_id = $1', [testBuyerId]);
    expect(check.rows[0].count).toBe(0);
  }, 30_000);
});
