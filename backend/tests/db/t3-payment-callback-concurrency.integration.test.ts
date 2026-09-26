import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import { PaymentService } from '../../src/modules/payment/services/payment.service.ts';
import { PgPaymentRepository } from '../../src/modules/payment/repositories/pg-payment.repository.ts';
import { PgOrderRepository } from '../../src/modules/order/repositories/pg-order.repository.ts';
import {
  createFixtureCategory,
  createFixtureOrder,
  createFixturePayment,
  createFixtureProduct,
  createFixtureShop,
  createFixtureUser,
  ensureAuthUser,
} from './fixtures/database-fixtures.js';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Payment callback PostgreSQL concurrency acceptance (T3)', () => {
  let pool: Pool | undefined;
  const userIds: string[] = [];
  const shopIds: string[] = [];
  const categoryIds: string[] = [];

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 4 } });
  }, 45_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM payments WHERE order_id IN (SELECT order_id FROM orders WHERE buyer_id = ANY($1::uuid[]))', [userIds]);
    await pool.query('DELETE FROM orders WHERE buyer_id = ANY($1::uuid[])', [userIds]);
    await pool.query('DELETE FROM products WHERE shop_id = ANY($1::uuid[])', [shopIds]);
    await pool.query('DELETE FROM shops WHERE shop_id = ANY($1::uuid[])', [shopIds]);
    await pool.query('DELETE FROM categories WHERE category_id = ANY($1::uuid[])', [categoryIds]);
    await pool.query('DELETE FROM app_users WHERE user_id = ANY($1::uuid[])', [userIds]);
    await pool.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [userIds]);
    await closeDatabasePool(pool);
  }, 30_000);

  it('allows exactly one of two SUCCESS callbacks to settle a pending payment', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const createUser = async (role: 'BUYER' | 'SELLER') => {
      const userId = randomUUID();
      const email = `${role.toLowerCase()}_${userId.slice(0, 8)}@fixture.test`;
      await ensureAuthUser(pool!, userId, email);
      return createFixtureUser(pool!, { userId, email, role });
    };
    const seller = await createUser('SELLER');
    const buyer = await createUser('BUYER');
    userIds.push(seller.userId, buyer.userId);
    const shop = await createFixtureShop(pool, seller.userId);
    shopIds.push(shop.shopId);
    const category = await createFixtureCategory(pool);
    categoryIds.push(category.categoryId);
    await createFixtureProduct(pool, shop.shopId, category.categoryId);
    const order = await createFixtureOrder(pool, buyer.userId, shop.shopId);
    const payment = await createFixturePayment(pool, order.orderId, { amount: order.totalAmount, status: 'PENDING' });

    const service = () => new PaymentService({
      pool,
      paymentRepo: new PgPaymentRepository(pool!),
      orderRepo: new PgOrderRepository(pool!),
    });
    const results = await Promise.allSettled([
      service().settlePayment(payment.paymentId, 'SUCCESS'),
      service().settlePayment(payment.paymentId, 'SUCCESS'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toBeDefined();
    if (rejected?.status === 'rejected') expect(rejected.reason).toMatchObject({ code: 'PAYMENT_STATE_INVALID' });

    const persisted = await pool.query<{ status: string; paid_at: Date | null }>(
      'SELECT status, paid_at FROM payments WHERE payment_id = $1',
      [payment.paymentId],
    );
    expect(persisted.rows[0].status).toBe('SUCCESS');
    expect(persisted.rows[0].paid_at).not.toBeNull();
  }, 30_000);
});
