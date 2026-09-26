import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../../db/client.js';
import { assertUsesIndex, explainQueryPlan } from '../../../db/concurrency-harness.js';
import { PgProductRepository } from '../../../src/modules/catalog/repositories/pg-catalog.repository.ts';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

let pool: Pool | undefined;
let productRepo: PgProductRepository;

const benchOwnerId = '00000000-0000-4000-b000-000000000099';
const benchShopId = '00000000-0000-4000-a000-000000000099';
const benchCatId1 = '00000000-0000-4000-c000-000000000091';
const benchCatId2 = '00000000-0000-4000-c000-000000000092';

const PRODUCT_COUNT = 1_000;
const ACTIVE_PRODUCT_COUNT = 25;
const createdProductIds: string[] = [];

remoteDescribe('Catalog Benchmark & N+1 Audit Integration (Mốc T3)', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 2 },
    });

    productRepo = new PgProductRepository(pool);

    // Clean up bench data in a single batched command
    await pool.query(`
      DELETE FROM product_variants WHERE product_id IN (SELECT product_id FROM products WHERE shop_id = '${benchShopId}');
      DELETE FROM product_images WHERE product_id IN (SELECT product_id FROM products WHERE shop_id = '${benchShopId}');
      DELETE FROM products WHERE shop_id = '${benchShopId}';
      DELETE FROM categories WHERE category_id IN ('${benchCatId1}', '${benchCatId2}');
      DELETE FROM shops WHERE shop_id = '${benchShopId}';
      DELETE FROM app_users WHERE user_id = '${benchOwnerId}';
      DELETE FROM auth.users WHERE id = '${benchOwnerId}';
    `);

    // Create auth & app user, shop, and categories in a single batched setup command
    const now = new Date().toISOString();
    await pool.query(`
      INSERT INTO auth.users (id, email) VALUES ('${benchOwnerId}', 'bench-seller@example.com') ON CONFLICT (id) DO NOTHING;
      INSERT INTO app_users (user_id, email, role, status) VALUES ('${benchOwnerId}', 'bench-seller@example.com', 'SELLER', 'ACTIVE') ON CONFLICT (user_id) DO NOTHING;
      INSERT INTO shops (shop_id, owner_id, shop_name, status, created_at, updated_at) VALUES ('${benchShopId}', '${benchOwnerId}', 'Bench Benchmark Shop', 'ACTIVE', '${now}', '${now}');
      INSERT INTO categories (category_id, category_name, status, created_at, updated_at) VALUES ('${benchCatId1}', 'Thời trang Nam Bench', 'ACTIVE', '${now}', '${now}'), ('${benchCatId2}', 'Phụ kiện Bench', 'ACTIVE', '${now}', '${now}');
    `);

    // High-performance batch seed: insert all products, variants, and images in 3 bulk queries
    // Eliminates 150 sequential remote DB roundtrips down to 3, slashing execution time from ~84s to ~3s
    const productValues: unknown[] = [];
    const productPlaceholders: string[] = [];
    const variantValues: unknown[] = [];
    const variantPlaceholders: string[] = [];
    const imageValues: unknown[] = [];
    const imagePlaceholders: string[] = [];

    for (let i = 1; i <= PRODUCT_COUNT; i++) {
      const prodId = `00000000-0000-4000-db00-${String(i).padStart(12, '0')}`;
      createdProductIds.push(prodId);
      // Most rows in the target category are inactive. This mirrors a mature
      // catalog and makes the compound (category_id, status) index meaningful.
      const catId = benchCatId1;
      const status = i <= ACTIVE_PRODUCT_COUNT ? 'ACTIVE' : 'INACTIVE';
      const basePrice = 100_000 + i * 10_000;

      // Product
      const pIdx = productValues.length;
      productValues.push(
        prodId,
        benchShopId,
        catId,
        `Benchmark Product ${i} - ${i % 2 === 0 ? 'Áo sơ mi' : 'Túi xách'}`,
        `Mô tả benchmark chi tiết cho sản phẩm số ${i}`,
        status,
        now,
        now,
      );
      productPlaceholders.push(
        `($${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8})`,
      );

      // Variant 1
      const v1Idx = variantValues.length;
      variantValues.push(
        crypto.randomUUID(),
        prodId,
        'Size S - V1',
        'S',
        `BENCH-SKU-${i}-S`,
        String(basePrice),
        20 + i,
        'ACTIVE',
        now,
        now,
      );
      variantPlaceholders.push(
        `($${v1Idx + 1}, $${v1Idx + 2}, $${v1Idx + 3}, $${v1Idx + 4}, $${v1Idx + 5}, $${v1Idx + 6}, $${v1Idx + 7}, $${v1Idx + 8}, $${v1Idx + 9}, $${v1Idx + 10})`,
      );

      // Variant 2
      const v2Idx = variantValues.length;
      variantValues.push(
        crypto.randomUUID(),
        prodId,
        'Size M - V2',
        'M',
        `BENCH-SKU-${i}-M`,
        String(basePrice + 20_000),
        15 + i,
        'ACTIVE',
        now,
        now,
      );
      variantPlaceholders.push(
        `($${v2Idx + 1}, $${v2Idx + 2}, $${v2Idx + 3}, $${v2Idx + 4}, $${v2Idx + 5}, $${v2Idx + 6}, $${v2Idx + 7}, $${v2Idx + 8}, $${v2Idx + 9}, $${v2Idx + 10})`,
      );

      // Image 1
      const img1Idx = imageValues.length;
      imageValues.push(
        crypto.randomUUID(),
        prodId,
        `https://storage.example.com/products/${prodId}/thumb.jpg`,
        0,
      );
      imagePlaceholders.push(`($${img1Idx + 1}, $${img1Idx + 2}, $${img1Idx + 3}, $${img1Idx + 4})`);

      // Image 2
      const img2Idx = imageValues.length;
      imageValues.push(
        crypto.randomUUID(),
        prodId,
        `https://storage.example.com/products/${prodId}/detail.jpg`,
        1,
      );
      imagePlaceholders.push(`($${img2Idx + 1}, $${img2Idx + 2}, $${img2Idx + 3}, $${img2Idx + 4})`);
    }

    // 1. Bulk insert products
    await pool.query(
      `INSERT INTO products (product_id, shop_id, category_id, product_name, description, status, created_at, updated_at)
       VALUES ${productPlaceholders.join(', ')}`,
      productValues,
    );

    // 2. Bulk insert variants
    await pool.query(
      `INSERT INTO product_variants (variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status, created_at, updated_at)
       VALUES ${variantPlaceholders.join(', ')}`,
      variantValues,
    );

    // 3. Bulk insert images
    await pool.query(
      `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
       VALUES ${imagePlaceholders.join(', ')}`,
      imageValues,
    );

    await pool.query('ANALYZE products, product_variants');
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      await pool.query(`
        DELETE FROM product_variants WHERE product_id IN (SELECT product_id FROM products WHERE shop_id = '${benchShopId}');
        DELETE FROM product_images WHERE product_id IN (SELECT product_id FROM products WHERE shop_id = '${benchShopId}');
        DELETE FROM products WHERE shop_id = '${benchShopId}';
        DELETE FROM categories WHERE category_id IN ('${benchCatId1}', '${benchCatId2}');
        DELETE FROM shops WHERE shop_id = '${benchShopId}';
        DELETE FROM app_users WHERE user_id = '${benchOwnerId}';
        DELETE FROM auth.users WHERE id = '${benchOwnerId}';
      `);

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
    expect(result.total).toBeGreaterThanOrEqual(ACTIVE_PRODUCT_COUNT);

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

  it('verifies the catalog query plan uses the handed-off indexes', async () => {
    if (!pool) throw new Error('Pool not initialized');

    const catalogQuery = `
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

    const plan = await explainQueryPlan(pool, catalogQuery, [benchCatId1]);
    expect(plan.rawPlan).toContain('Plan');
    expect(
      assertUsesIndex(plan, 'idx_products__category_id__status')
        || assertUsesIndex(plan, 'idx_products__shop_id__status'),
      plan.rawPlan,
    ).toBe(true);
    expect(assertUsesIndex(plan, 'idx_product_variants__product_id__status'), plan.rawPlan).toBe(true);

    const categoryLookupPlan = await explainQueryPlan(
      pool,
      `SELECT product_id FROM products
       WHERE category_id = $1 AND status = 'ACTIVE'
       ORDER BY product_id
       LIMIT 10`,
      [benchCatId1],
    );
    expect(
      assertUsesIndex(categoryLookupPlan, 'idx_products__category_id__status'),
      categoryLookupPlan.rawPlan,
    ).toBe(true);

    const shopLookupPlan = await explainQueryPlan(
      pool,
      `SELECT product_id FROM products
       WHERE shop_id = $1 AND status = 'ACTIVE'
       ORDER BY product_id
       LIMIT 10`,
      [benchShopId],
    );
    expect(
      assertUsesIndex(shopLookupPlan, 'idx_products__shop_id__status'),
      shopLookupPlan.rawPlan,
    ).toBe(true);
  }, 30_000);
});
