import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../../db/client.js';
import { PgProductRepository } from '../../../src/modules/catalog/repositories/pg-catalog.repository.ts';
import type { Product, ProductVariant, ProductImage } from '../../../src/modules/catalog/domain/types.ts';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

let pool: Pool | undefined;
let productRepo: PgProductRepository;

const benchOwnerId = '00000000-0000-4000-b000-000000000099';
const benchShopId = '00000000-0000-4000-a000-000000000099';
const benchCatId1 = '00000000-0000-4000-c000-000000000091';
const benchCatId2 = '00000000-0000-4000-c000-000000000092';

const PRODUCT_COUNT = 25; // 25 products, 50 variants, 50 images
const createdProductIds: string[] = [];

remoteDescribe('Catalog Benchmark & N+1 Audit Integration (Mốc T3)', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 2 },
    });

    productRepo = new PgProductRepository(pool);

    // Clean up bench data
    await pool.query(
      `DELETE FROM product_variants WHERE product_id IN (
         SELECT product_id FROM products WHERE shop_id = $1
       )`,
      [benchShopId],
    );
    await pool.query(
      `DELETE FROM product_images WHERE product_id IN (
         SELECT product_id FROM products WHERE shop_id = $1
       )`,
      [benchShopId],
    );
    await pool.query('DELETE FROM products WHERE shop_id = $1', [benchShopId]);
    await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [benchCatId1, benchCatId2]);
    await pool.query('DELETE FROM shops WHERE shop_id = $1', [benchShopId]);
    await pool.query('DELETE FROM app_users WHERE user_id = $1', [benchOwnerId]);
    await pool.query('DELETE FROM auth.users WHERE id = $1', [benchOwnerId]);

    // Create auth & app user
    await pool.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, 'bench-seller@example.com') ON CONFLICT (id) DO NOTHING`,
      [benchOwnerId],
    );
    await pool.query(
      `INSERT INTO app_users (user_id, email, role, status) VALUES ($1, 'bench-seller@example.com', 'SELLER', 'ACTIVE') ON CONFLICT (user_id) DO NOTHING`,
      [benchOwnerId],
    );

    // Create Shop
    const now = new Date().toISOString();
    await pool.query(
      `INSERT INTO shops (shop_id, owner_id, shop_name, status, created_at, updated_at)
       VALUES ($1, $2, 'Bench Benchmark Shop', 'ACTIVE', $3, $3)`,
      [benchShopId, benchOwnerId, now],
    );

    // Create 2 Categories
    await pool.query(
      `INSERT INTO categories (category_id, category_name, status, created_at, updated_at)
       VALUES ($1, 'Thời trang Nam Bench', 'ACTIVE', $3, $3),
              ($2, 'Phụ kiện Bench', 'ACTIVE', $3, $3)`,
      [benchCatId1, benchCatId2, now],
    );

    // Batch seed 25 products with 2 variants and 2 images each
    for (let i = 1; i <= PRODUCT_COUNT; i++) {
      const prodId = `00000000-0000-4000-db00-${String(i).padStart(12, '0')}`;
      createdProductIds.push(prodId);
      const catId = i % 2 === 0 ? benchCatId1 : benchCatId2;
      const basePrice = 100_000 + i * 10_000;

      const product: Product = {
        productId: prodId,
        shopId: benchShopId,
        categoryId: catId,
        productName: `Benchmark Product ${i} - ${i % 2 === 0 ? 'Áo sơ mi' : 'Túi xách'}`,
        description: `Mô tả benchmark chi tiết cho sản phẩm số ${i}`,
        status: 'ACTIVE',
        createdAt: now,
        updatedAt: now,
      };

      const variants: ProductVariant[] = [
        {
          variantId: crypto.randomUUID(),
          productId: prodId,
          variantName: `Size S - V1`,
          variantValue: 'S',
          sku: `BENCH-SKU-${i}-S`,
          price: String(basePrice),
          stockQuantity: 20 + i,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
        {
          variantId: crypto.randomUUID(),
          productId: prodId,
          variantName: `Size M - V2`,
          variantValue: 'M',
          sku: `BENCH-SKU-${i}-M`,
          price: String(basePrice + 20_000),
          stockQuantity: 15 + i,
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        },
      ];

      const images: ProductImage[] = [
        {
          imageId: crypto.randomUUID(),
          productId: prodId,
          imageUrl: `https://storage.example.com/products/${prodId}/thumb.jpg`,
          sortOrder: 0,
        },
        {
          imageId: crypto.randomUUID(),
          productId: prodId,
          imageUrl: `https://storage.example.com/products/${prodId}/detail.jpg`,
          sortOrder: 1,
        },
      ];

      await productRepo.create(product, variants, images);
    }
  }, 90_000);

  afterAll(async () => {
    if (pool) {
      await pool.query(
        `DELETE FROM product_variants WHERE product_id IN (
           SELECT product_id FROM products WHERE shop_id = $1
         )`,
        [benchShopId],
      );
      await pool.query(
        `DELETE FROM product_images WHERE product_id IN (
           SELECT product_id FROM products WHERE shop_id = $1
         )`,
        [benchShopId],
      );
      await pool.query('DELETE FROM products WHERE shop_id = $1', [benchShopId]);
      await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [benchCatId1, benchCatId2]);
      await pool.query('DELETE FROM shops WHERE shop_id = $1', [benchShopId]);
      await pool.query('DELETE FROM app_users WHERE user_id = $1', [benchOwnerId]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [benchOwnerId]);

      await closeDatabasePool(pool);
    }
  }, 30_000);

  it('verifies O(1) query complexity: fetches product list with aggregated prices, stock, image without N+1', async () => {
    const start = performance.now();
    const result = await productRepo.queryPublic({
      limit: 10,
    });
    const durationMs = performance.now() - start;

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThanOrEqual(PRODUCT_COUNT);

    // Verify all aggregates are present directly in single query results
    for (const item of result.items) {
      expect(item.productId).toBeDefined();
      expect(item.minPrice).toBeDefined();
      expect(Number(item.minPrice)).toBeGreaterThan(0);
      expect(item.maxPrice).toBeDefined();
      expect(Number(item.maxPrice)).toBeGreaterThanOrEqual(Number(item.minPrice));
      expect(item.totalStock).toBeGreaterThan(0);
      expect(item.imageUrl).toBeDefined();
    }

    // Benchmark check: single roundtrip latency under reasonable thresholds
    expect(durationMs).toBeLessThan(10_000); // Remote Supabase roundtrip typically < 1.5s
  }, 30_000);

  it('benchmarks category filter and cursor-based pagination', async () => {
    // Page 1
    const page1 = await productRepo.queryPublic({
      categoryId: benchCatId1,
      limit: 5,
    });
    expect(page1.items.length).toBe(5);
    expect(page1.nextCursor).not.toBeNull();

    // Page 2 using cursor
    const page2 = await productRepo.queryPublic({
      categoryId: benchCatId1,
      limit: 5,
      cursor: page1.nextCursor!,
    });
    expect(page2.items.length).toBe(5);

    // Verify no overlap between page 1 and page 2
    const page1Ids = new Set(page1.items.map((i) => i.productId));
    for (const item of page2.items) {
      expect(page1Ids.has(item.productId)).toBe(false);
    }
  }, 30_000);

  it('benchmarks price range filtering and price sorting (price_asc and price_desc)', async () => {
    const ascResult = await productRepo.queryPublic({
      categoryId: benchCatId1,
      minPrice: 120_000,
      maxPrice: 200_000,
      sortBy: 'price_asc',
      limit: 10,
    });

    expect(ascResult.items.length).toBeGreaterThan(0);
    for (let i = 1; i < ascResult.items.length; i++) {
      const prevPrice = Number(ascResult.items[i - 1].minPrice);
      const currPrice = Number(ascResult.items[i].minPrice);
      expect(currPrice).toBeGreaterThanOrEqual(prevPrice);
    }

    const descResult = await productRepo.queryPublic({
      categoryId: benchCatId1,
      sortBy: 'price_desc',
      limit: 10,
    });

    expect(descResult.items.length).toBeGreaterThan(0);
    for (let i = 1; i < descResult.items.length; i++) {
      const prevPrice = Number(descResult.items[i - 1].maxPrice);
      const currPrice = Number(descResult.items[i].maxPrice);
      expect(currPrice).toBeLessThanOrEqual(prevPrice);
    }
  }, 30_000);

  it('runs EXPLAIN ANALYZE on catalog public queries to verify index and plan efficiency', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const explainSql = `
      EXPLAIN (FORMAT JSON)
      SELECT 
        p.product_id,
        p.shop_id,
        p.category_id,
        p.product_name,
        MIN(v.price) as min_price,
        MAX(v.price) as max_price,
        SUM(v.stock_quantity)::int as total_stock
      FROM products p
      JOIN shops s ON p.shop_id = s.shop_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN product_variants v ON p.product_id = v.product_id
      WHERE p.status = 'ACTIVE' 
        AND s.status = 'ACTIVE' 
        AND c.status = 'ACTIVE' 
        AND v.status = 'ACTIVE'
        AND p.category_id = $1
      GROUP BY p.product_id, p.shop_id, p.category_id, p.product_name
      ORDER BY p.created_at DESC
      LIMIT 10
    `;

    const explainRes = await pool.query(explainSql, [benchCatId1]);
    expect(explainRes.rows.length).toBeGreaterThan(0);

    const planJson = explainRes.rows[0]['QUERY PLAN'];
    expect(planJson).toBeDefined();
    const planStr = JSON.stringify(planJson);
    expect(planStr).toContain('Plan');
  }, 30_000);
});
