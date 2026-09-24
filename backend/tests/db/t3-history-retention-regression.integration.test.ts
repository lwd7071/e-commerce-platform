import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
  createFixtureOrder,
  createFixtureOrderItem,
  createFixturePayment,
  createFixtureReview,
  createFixtureCart,
  createFixtureCartItem,
} from './fixtures/database-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Strict Transaction History Retention & RLS Regression (T3 [QD16])', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });

    // Áp dụng T3 idempotency RLS hardening migration một cách idempotent
    const migrationPath = path.resolve(
      __dirname,
      '../../prisma/migrations/20260924120000_t3_idempotency_rls_hardening/migration.sql',
    );
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(sql);
    }
  }, 45_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  }, 20_000);

  const makeTestUser = async (client: Pool | PoolClient, role: 'BUYER' | 'SELLER' | 'ADMIN') => {
    const id = randomUUID();
    const email = `test_t3_${id.slice(0, 8)}@example.test`;
    await ensureAuthUser(client, id, email);
    return createFixtureUser(client, { userId: id, email, role });
  };

  describe('[QD16] Transaction history data cannot be deleted physically', () => {
    it('blocks deleting orders when order_items, payments or shipments exist (SQLSTATE 23503)', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);

        const order = await createFixtureOrder(client, buyer.userId, shop.shopId);
        await createFixtureOrderItem(client, order.orderId, prod.productId, variant.variantId);
        await createFixturePayment(client, order.orderId);

        // Thử xóa vật lý order -> phải bị chặn bởi RESTRICT từ order_items / payments
        await client.query('SAVEPOINT sp_del_order');
        await expect(
          client.query('DELETE FROM orders WHERE order_id = $1', [order.orderId]),
        ).rejects.toMatchObject({ code: '23503' });
        await client.query('ROLLBACK TO SAVEPOINT sp_del_order');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);

    it('blocks deleting order_items when reviews reference them (SQLSTATE 23503)', async () => {
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
        await createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId);

        // Thử xóa vật lý order_item khi đã có review -> bị chặn bởi fk_reviews__order_item_id
        await client.query('SAVEPOINT sp_del_item');
        await expect(
          client.query('DELETE FROM order_items WHERE order_item_id = $1', [item.orderItemId]),
        ).rejects.toMatchObject({ code: '23503' });
        await client.query('ROLLBACK TO SAVEPOINT sp_del_item');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);

    it('blocks deleting products or product_variants that have participated in orders (SQLSTATE 23503)', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);

        const order = await createFixtureOrder(client, buyer.userId, shop.shopId);
        await createFixtureOrderItem(client, order.orderId, prod.productId, variant.variantId);

        // 1. Thử xóa product_variant đã có trong order_item -> bị chặn
        await client.query('SAVEPOINT sp_del_variant');
        await expect(
          client.query('DELETE FROM product_variants WHERE variant_id = $1', [variant.variantId]),
        ).rejects.toMatchObject({ code: '23503' });
        await client.query('ROLLBACK TO SAVEPOINT sp_del_variant');

        // 2. Thử xóa product chứa variant đó -> bị chặn bởi fk_product_variants__product_id
        await client.query('SAVEPOINT sp_del_prod');
        await expect(
          client.query('DELETE FROM products WHERE product_id = $1', [prod.productId]),
        ).rejects.toMatchObject({ code: '23503' });
        await client.query('ROLLBACK TO SAVEPOINT sp_del_prod');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);

    it('blocks deleting shops that have existing products or orders (SQLSTATE 23503)', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        await createFixtureProduct(client, shop.shopId, cat.categoryId);

        // Thử xóa shop khi đã có product -> bị chặn bởi fk_products__shop_id
        await client.query('SAVEPOINT sp_del_shop');
        await expect(
          client.query('DELETE FROM shops WHERE shop_id = $1', [shop.shopId]),
        ).rejects.toMatchObject({ code: '23503' });
        await client.query('ROLLBACK TO SAVEPOINT sp_del_shop');

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);
  });

  describe('Permitted CASCADE deletions are isolated to auxiliary non-historical entities', () => {
    it('cascades deletion from reviews to review_images safely', async () => {
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
        const review = await createFixtureReview(client, buyer.userId, prod.productId, item.orderItemId);

        // Tạo review_image
        const imageId = randomUUID();
        await client.query(
          `INSERT INTO review_images (review_image_id, review_id, image_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [imageId, review.reviewId, 'https://example.com/rev.jpg', 0],
        );

        // Xóa review -> review_images tự động bị cascade xóa theo
        await client.query('DELETE FROM reviews WHERE review_id = $1', [review.reviewId]);

        const imgCheck = await client.query('SELECT count(*)::int AS cnt FROM review_images WHERE review_image_id = $1', [imageId]);
        expect(imgCheck.rows[0].cnt).toBe(0);

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);

    it('cascades deletion from carts to cart_items safely without affecting vouchers or products', async () => {
      if (!pool) throw new Error('Pool not initialized');

      await withTransaction(pool, async (client) => {
        const buyer = await makeTestUser(client, 'BUYER');
        const seller = await makeTestUser(client, 'SELLER');
        const shop = await createFixtureShop(client, seller.userId);
        const cat = await createFixtureCategory(client);
        const prod = await createFixtureProduct(client, shop.shopId, cat.categoryId);
        const variant = await createFixtureVariant(client, prod.productId);

        const cart = await createFixtureCart(client, buyer.userId);
        const cartItem = await createFixtureCartItem(client, cart.cartId, variant.variantId, { quantity: 2 });

        // Xóa cart -> cart_items tự động cascade xóa
        await client.query('DELETE FROM carts WHERE cart_id = $1', [cart.cartId]);

        const itemCheck = await client.query(
          'SELECT count(*)::int AS cnt FROM cart_items WHERE cart_item_id = $1',
          [cartItem.cartItemId],
        );
        expect(itemCheck.rows[0].cnt).toBe(0);

        // Variant vẫn tồn tại nguyên vẹn
        const varCheck = await client.query(
          'SELECT count(*)::int AS cnt FROM product_variants WHERE variant_id = $1',
          [variant.variantId],
        );
        expect(varCheck.rows[0].cnt).toBe(1);

        throw new Error('ROLLBACK');
      }).catch((e) => { if (e.message !== 'ROLLBACK') throw e; });
    }, 30_000);
  });

  describe('Operational table api_idempotency_records & RLS defense-in-depth', () => {
    it('confirms api_idempotency_records has row-level security enabled', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const res = await pool.query<{ relrowsecurity: boolean }>(
        `SELECT c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'api_idempotency_records'`,
      );

      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].relrowsecurity).toBe(true);
    });

    it('guarantees neither anon nor authenticated have direct table privileges on api_idempotency_records', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const grants = await pool.query(
        `SELECT grantee, privilege_type
         FROM information_schema.table_privileges
         WHERE table_schema = 'public'
           AND table_name = 'api_idempotency_records'
           AND grantee IN ('anon', 'authenticated')`,
      );

      expect(grants.rows).toEqual([]);
    });

    it('blocks direct queries on api_idempotency_records when assuming anon or authenticated roles (SQLSTATE 42501)', async () => {
      if (!pool) throw new Error('Pool not initialized');
      const client = await pool.connect();

      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE anon');

        await client.query('SAVEPOINT sp_anon_idemp');
        await expect(
          client.query('SELECT * FROM api_idempotency_records LIMIT 1'),
        ).rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK TO SAVEPOINT sp_anon_idemp');

        await client.query('SET LOCAL ROLE authenticated');
        await client.query('SAVEPOINT sp_auth_idemp');
        await expect(
          client.query('SELECT * FROM api_idempotency_records LIMIT 1'),
        ).rejects.toMatchObject({ code: '42501' });
        await client.query('ROLLBACK TO SAVEPOINT sp_auth_idemp');

        await client.query('ROLLBACK');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    }, 20_000);
  });
});
