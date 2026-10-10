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
import { ModerationService } from '../../src/modules/moderation/services/moderation.service.ts';
import { PgModerationTargetRepository } from '../../src/modules/moderation/repositories/pg-target.repository.ts';
import { PgAuditRepository } from '../../src/platform/audit/pg-audit.repository.ts';
import { PgTransactionManager } from '../../src/platform/database/pg-transaction-manager.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Admin Moderation API: Product/Review HIDE & Audit Rollback (isolated PostgreSQL schema)', { sequential: true, timeout: 60_000 }, () => {
  const schema = `admin_mod_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let app: ReturnType<typeof createApp>;
  let adminId: string;
  let moderationService: ModerationService;

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

    moderationService = new ModerationService(
      new PgModerationTargetRepository(pool),
      new PgAuditRepository(pool),
      new PgTransactionManager(pool)
    );

    app = createApp({
      pool,
      moderation: moderationService,
      rateLimiter: false,
      auth: (req, _res, next) => {
        req.context = { user_id: adminId, role: 'ADMIN', request_id: req.requestId ?? 'admin-mod-pg' };
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

  it('[ADMIN-06] hides and restores product with atomic admin_logs audit', async () => {
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [sellerId]);
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId, { productName: 'Spam Phone Case' });
    await createFixtureVariant(pool, product.productId);

    // 1. Admin HIDE sản phẩm
    const hideRes = await request(app)
      .patch(`/api/v1/admin/products/${product.productId}/moderate`)
      .send({ status: 'HIDDEN', reason: 'Hàng vi phạm bản quyền' })
      .expect(200);

    expect(hideRes.body.data.status).toBe('HIDDEN');

    // Kiểm tra DB product status
    const dbProduct = await pool.query('SELECT status FROM products WHERE product_id = $1', [product.productId]);
    expect(dbProduct.rows[0].status).toBe('HIDDEN');

    // Kiểm tra admin_logs audit table
    const auditRes = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'HIDE_PRODUCT'",
      [product.productId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].reason).toBe('Hàng vi phạm bản quyền');
    expect(auditRes.rows[0].admin_id).toBe(adminId);

    // 2. Admin RESTORE lại sản phẩm
    const restoreRes = await request(app)
      .patch(`/api/v1/admin/products/${product.productId}/moderate`)
      .send({ status: 'ACTIVE', reason: 'Shop đã bổ sung giấy phép kinh doanh' })
      .expect(200);

    expect(restoreRes.body.data.status).toBe('ACTIVE');

    const dbProductRestored = await pool.query('SELECT status FROM products WHERE product_id = $1', [product.productId]);
    expect(dbProductRestored.rows[0].status).toBe('ACTIVE');

    const restoreAudit = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'RESTORE_PRODUCT'",
      [product.productId]
    );
    expect(restoreAudit.rows.length).toBe(1);
    expect(restoreAudit.rows[0].reason).toBe('Shop đã bổ sung giấy phép kinh doanh');
  });

  it('[ADMIN-06] hides and restores review with atomic admin_logs audit', async () => {
    const buyerId = randomUUID();
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1), ($2)', [buyerId, sellerId]);
    await createFixtureUser(pool, { userId: buyerId, role: 'BUYER' });
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId);
    const variant = await createFixtureVariant(pool, product.productId);
    const order = await createFixtureOrder(pool, buyerId, shop.shopId, { status: 'COMPLETED' });

    // Insert order item and review
    const orderItemId = randomUUID();
    await pool.query(
      "INSERT INTO order_items (order_item_id, order_id, product_id, variant_id, product_name_snapshot, unit_price, quantity, line_total) VALUES ($1, $2, $3, $4, 'Item', '10.00', 1, '10.00')",
      [orderItemId, order.orderId, product.productId, variant.variantId]
    );

    const reviewId = randomUUID();
    await pool.query(
      `INSERT INTO reviews (review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, 'Spam thô tục', 'VISIBLE', now(), now())`,
      [reviewId, buyerId, product.productId, orderItemId]
    );

    // 1. Admin HIDE review
    const hideRes = await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}/moderate`)
      .send({ status: 'HIDDEN', reason: 'Ngôn từ xúc phạm người bán' })
      .expect(200);

    expect(hideRes.body.data.status).toBe('HIDDEN');

    const dbReview = await pool.query('SELECT status FROM reviews WHERE review_id = $1', [reviewId]);
    expect(dbReview.rows[0].status).toBe('HIDDEN');

    const auditRes = await pool.query(
      "SELECT * FROM admin_logs WHERE target_id = $1 AND action = 'HIDE_REVIEW'",
      [reviewId]
    );
    expect(auditRes.rows.length).toBe(1);
    expect(auditRes.rows[0].reason).toBe('Ngôn từ xúc phạm người bán');

    // 2. Admin RESTORE review
    const restoreRes = await request(app)
      .patch(`/api/v1/admin/reviews/${reviewId}/moderate`)
      .send({ status: 'VISIBLE', reason: 'Đã xem xét lại nội dung hợp lệ' })
      .expect(200);

    expect(restoreRes.body.data.status).toBe('VISIBLE');
    const dbReviewRestored = await pool.query('SELECT status FROM reviews WHERE review_id = $1', [reviewId]);
    expect(dbReviewRestored.rows[0].status).toBe('VISIBLE');
  });

  it('[ADMIN-06] rolls back product status change when audit logging fails (QD20)', async () => {
    const sellerId = randomUUID();
    await pool.query('INSERT INTO fixture_auth_users VALUES ($1)', [sellerId]);
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });
    const shop = await createFixtureShop(pool, sellerId);
    const category = await createFixtureCategory(pool);
    const product = await createFixtureProduct(pool, shop.shopId, category.categoryId, { productName: 'Rollback Test Product' });

    // Tạo moderation service có audit port ném lỗi cố ý
    const failingAuditPort = {
      logAdminAction: async () => {
        throw new Error('Database disk full or audit network timeout');
      },
    };

    const failingService = new ModerationService(
      new PgModerationTargetRepository(pool),
      failingAuditPort,
      new PgTransactionManager(pool)
    );

    const failingApp = createApp({
      pool,
      moderation: failingService,
      rateLimiter: false,
      auth: (req, _res, next) => {
        req.context = { user_id: adminId, role: 'ADMIN', request_id: 'fail-audit-req' };
        next();
      },
    });

    // Gọi HIDE qua app với failing audit port
    const res = await request(failingApp)
      .patch(`/api/v1/admin/products/${product.productId}/moderate`)
      .send({ status: 'HIDDEN', reason: 'Thử nghiệm rollback audit' })
      .expect(500);

    expect(res.body.error.code).toBe('AUDIT_WRITE_FAILED');

    // Kiểm tra trong DB: product status VẪN LÀ ACTIVE (đã bị rollback, không bị đổi thành HIDDEN)
    const checkDb = await pool.query('SELECT status FROM products WHERE product_id = $1', [product.productId]);
    expect(checkDb.rows[0].status).toBe('ACTIVE');

    // Không có bản ghi moderation_records nào được commit
    const checkMod = await pool.query('SELECT * FROM moderation_records WHERE target_id = $1', [product.productId]);
    expect(checkMod.rows.length).toBe(0);
  });
});
