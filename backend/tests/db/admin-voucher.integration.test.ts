import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import {
  createFixtureAddress,
  createFixtureCart,
  createFixtureCategory,
  createFixtureProduct,
  createFixtureShop,
  createFixtureUser,
  createFixtureVariant,
  applyShippingMigration,
} from './fixtures/database-fixtures.ts';
import { createApp } from '../../src/platform/http/app.ts';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import { PgBuyerHttpService } from '../../src/modules/buyer/services/pg-buyer-http.service.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin Platform Voucher & Checkout Restriction (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_vch_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;
  let adminId: string;
  let buyerId: string;

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
    const idempotencyMigration = await readFile(new URL('../../prisma/migrations/20260918170000_add_api_idempotency_records/migration.sql', import.meta.url), 'utf8');
    await pool.query(idempotencyMigration);
    await applyShippingMigration(pool);

    adminId = randomUUID();
    buyerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2)', [adminId, buyerId]);
    await createFixtureUser(pool, { userId: adminId, role: 'ADMIN' });
    await createFixtureUser(pool, { userId: buyerId, role: 'BUYER' });

    const checkoutService = new PgCheckoutService(pool);
    const buyerService = new PgBuyerHttpService(pool);

    app = createApp({
      pool,
      rateLimiter: false,
      buyer: buyerService,
      orderServices: {
        checkoutService,
      },
      auth: (req, _res, next) => {
        // Mặc định là ADMIN trừ khi header giả lập buyer
        const role = req.header('x-test-role') === 'BUYER' ? 'BUYER' : 'ADMIN';
        const userId = role === 'BUYER' ? buyerId : adminId;
        req.context = { user_id: userId, role, request_id: req.requestId ?? 'admin-vch-pg' };
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

  it('[ADMIN-08] creates, deactivates platform voucher with audit, and enforces checkout rejection when INACTIVE', async () => {
    // 1. Admin tạo platform voucher
    const createRes = await request(app)
      .post('/api/v1/admin/vouchers')
      .send({
        code: 'PLATFORM50K',
        voucher_name: 'Giảm 50k toàn sàn',
        discount_type: 'FIXED',
        discount_value: '50.00',
        max_discount: null,
        min_order_value: '100.00',
        quantity: 100,
        start_at: new Date(Date.now() - 3600_000).toISOString(),
        end_at: new Date(Date.now() + 86400_000).toISOString(),
        reason: 'Chiến dịch khuyến mãi đầu tháng',
      })
      .expect(201);

    const voucherId = createRes.body.data.voucher_id;
    expect(createRes.body.data.code).toBe('PLATFORM50K');
    expect(createRes.body.data.status).toBe('ACTIVE');

    // Kiểm tra audit log tạo voucher
    const createAudit = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'CREATE_PLATFORM_VOUCHER'",
      [voucherId]
    );
    expect(createAudit.rows.length).toBe(1);
    expect(createAudit.rows[0].reason).toBe('Chiến dịch khuyến mãi đầu tháng');

    // 2. Admin chuyển trạng thái voucher sang INACTIVE
    const statusRes = await request(app)
      .patch(`/api/v1/admin/vouchers/${voucherId}/status`)
      .send({
        status: 'INACTIVE',
        reason: 'Tạm ngưng do phát hiện gian lận voucher',
      })
      .expect(200);

    expect(statusRes.body.data.status).toBe('INACTIVE');

    // Kiểm tra audit log đổi trạng thái
    const statusAudit = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'INACTIVE_PLATFORM_VOUCHER'",
      [voucherId]
    );
    expect(statusAudit.rows.length).toBe(1);
    expect(statusAudit.rows[0].reason).toBe('Tạm ngưng do phát hiện gian lận voucher');

    // 3. Buyer cố gắng evaluate / checkout với voucher INACTIVE -> Bị từ chối
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [sellerId]);
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId);
    const variant = await createFixtureVariant(pool, product.productId, { price: '200.00', stockQuantity: 10 });
    const address = await createFixtureAddress(pool, buyerId);
    const cart = await createFixtureCart(pool, buyerId);

    // Thêm item vào cart
    const cartItemId = randomUUID();
    await pool.query(
      'INSERT INTO cart_items (cart_item_id, cart_id, variant_id, quantity, is_selected) VALUES ($1, $2, $3, 1, true)',
      [cartItemId, cart.cartId, variant.variantId]
    );

    // Kiểm tra danh sách voucher active của Buyer: không còn thấy PLATFORM50K
    const vouchersRes = await request(app)
      .get('/api/v1/vouchers')
      .set('x-test-role', 'BUYER')
      .expect(200);
    expect(vouchersRes.body.data.some((v: { code: string }) => v.code === 'PLATFORM50K')).toBe(false);

    const shippingQuote = await request(app)
      .post('/api/v1/shipping/quote')
      .set('x-test-role', 'BUYER')
      .send({ address_id: address.addressId })
      .expect(200);

    // Checkout thử với voucher INACTIVE -> Bị từ chối (422)
    const checkoutRes = await request(app)
      .post('/api/v1/checkout')
      .set('x-test-role', 'BUYER')
      .set('Idempotency-Key', 'idempotency-key-test-inactive-voucher-12345')
      .send({
        address_id: address.addressId,
        payment_method: 'COD',
        expected_shipping_fees: shippingQuote.body.data.quotes.map(({ shop_id, fee }: { shop_id: string; fee: string }) => ({ shop_id, fee })),
        vouchers: [{ shop_id: shop.shopId, code: 'PLATFORM50K' }],
      })
      .expect(422);

    expect(checkoutRes.body.error.message).toMatch(/voucher/i);
  });

  it('[ADMIN-08] rejects voucher status change without reason (422 REASON_REQUIRED)', async () => {
    // Tạo voucher tạm
    const voucherRes = await pool.query(
      `INSERT INTO vouchers (voucher_id, code, voucher_name, scope, shop_id, discount_type, discount_value, min_order_value, quantity, start_at, end_at, status)
       VALUES ($1, 'TESTREASON', 'Test Reason', 'PLATFORM', NULL, 'FIXED', 10, 50, 10, now(), now() + interval '1 day', 'ACTIVE')
       RETURNING voucher_id`,
      [randomUUID()]
    );
    const vId = voucherRes.rows[0].voucher_id;

    const res = await request(app)
      .patch(`/api/v1/admin/vouchers/${vId}/status`)
      .send({
        status: 'INACTIVE',
        reason: '   ',
      })
      .expect(422);

    expect(res.body.error.code).toBe('REASON_REQUIRED');
  });
});
