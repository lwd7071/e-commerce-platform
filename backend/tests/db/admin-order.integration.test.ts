import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import {
  createFixtureCategory,
  createFixtureOrder,
  createFixtureProduct,
  createFixtureShop,
  createFixtureUser,
  createFixtureVariant,
} from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import { OrderQueryService } from '../../src/modules/order/services/order-query.service.ts';
import { PgOrderRepository } from '../../src/modules/order/repositories/pg-order.repository.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin Order Intervention: Transition, History, Inventory & Audit (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_ord_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;
  let adminId: string;
  let checkoutService: PgCheckoutService;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 4,
      connectionTimeoutMillis: 10_000,
      options: `-c search_path=${schema} -c statement_timeout=20000`,
      application_name: schema,
    });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', 'fixture_auth_users'));

    adminId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [adminId]);
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });

    checkoutService = new PgCheckoutService(pool);
    const orderQueryService = new OrderQueryService(new PgOrderRepository(pool), pool);

    app = createApp({
      pool,
      orderServices: {
        checkoutService,
        orderQueryService,
        cancelOrder: (context, orderId, input) => checkoutService.cancelOrder(context, orderId, input),
        confirmOrder: (context, orderId, reason) => checkoutService.confirmOrder(context, orderId, reason),
        transitionOrder: (context, orderId, input) => checkoutService.transitionOrder(context, orderId, input),
        retryPayment: (context, orderId, input) => checkoutService.retryPayment(context, orderId, input),
      },
      rateLimiter: false,
      auth: (req, _res, next) => {
        req.context = { user_id: adminId, role: 'ADMIN', request_id: req.requestId ?? 'admin-ord-pg' };
        next();
      },
    });
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  it('[ADMIN-07] cancels order with reason, restores stock, writes order_status_history and admin_logs atomically', async () => {
    const buyerId = randomUUID();
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2)', [buyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId, role: 'BUYER' });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId);
    const variant = await createFixtureVariant(pool, product.productId, { stockQuantity: 5 });

    // Tạo order PENDING_CONFIRMATION với 2 sản phẩm (ban đầu stock đã bị trừ đi 2 còn 5)
    const order = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'PENDING_CONFIRMATION' });
    const orderItemId = randomUUID();
    await pool.query(
      `INSERT INTO order_items (order_item_id, order_id, product_id, variant_id, product_name_snapshot, unit_price, quantity, line_total)
       VALUES ($1, $2, $3, $4, 'Item', '50.00', 2, '100.00')`,
      [orderItemId, order.orderId, product.productId, variant.variantId]
    );

    // 1. Admin can thiệp huỷ đơn hàng
    const res = await request(app)
      .patch(`/api/v1/admin/orders/${order.orderId}/transition`)
      .send({
        to: 'CANCELLED',
        reason: 'Huỷ bởi Admin do người mua báo cáo gian lận',
      })
      .expect(200);

    expect(res.body.data.status).toBe('CANCELLED');

    // 2. Kiểm tra DB order
    const dbOrder = await pool.query('SELECT status, cancel_reason FROM orders WHERE order_id = $1', [order.orderId]);
    expect(dbOrder.rows[0].status).toBe('CANCELLED');
    expect(dbOrder.rows[0].cancel_reason).toBe('Huỷ bởi Admin do người mua báo cáo gian lận');

    // 3. Kiểm tra inventory restoration: 5 + 2 = 7
    const dbVariant = await pool.query('SELECT stock_quantity FROM product_variants WHERE variant_id = $1', [variant.variantId]);
    expect(dbVariant.rows[0].stock_quantity).toBe(7);

    // 4. Kiểm tra order_status_history
    const historyRes = await pool.query(
      'SELECT * FROM order_status_history WHERE order_id = $1 AND new_status = $2',
      [order.orderId, 'CANCELLED']
    );
    expect(historyRes.rows.length).toBe(1);
    expect(historyRes.rows[0].old_status).toBe('PENDING_CONFIRMATION');
    expect(historyRes.rows[0].changed_by).toBe(adminId);
    expect(historyRes.rows[0].reason).toBe('Huỷ bởi Admin do người mua báo cáo gian lận');

    // 5. Kiểm tra admin_logs audit record
    const auditRes = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'ORDER_CANCELLED'",
      [order.orderId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].reason).toBe('Huỷ bởi Admin do người mua báo cáo gian lận');
    expect(auditRes.rows[0].admin_id).toBe(adminId);
  });

  it('[ADMIN-07] rejects order transition without reason (422 REASON_REQUIRED)', async () => {
    const buyerId = randomUUID();
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2)', [buyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId, role: 'BUYER' });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const order = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'PENDING_CONFIRMATION' });

    const res = await request(app)
      .patch(`/api/v1/admin/orders/${order.orderId}/transition`)
      .send({
        to: 'CANCELLED',
        reason: '   ', // rỗng
      })
      .expect(422);

    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });
});
