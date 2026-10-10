import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../../db/client.js';
import { withTransaction } from '../../../db/transaction.js';
import {
  PgShopRepository,
  PgCategoryRepository,
  PgProductRepository,
  PgProductVariantRepository,
} from '../../../src/modules/catalog/repositories/pg-catalog.repository.ts';
import { CatalogPortService } from '../../../src/modules/catalog/services/catalog-port.service.ts';
import { InventoryInsufficientError } from '../../../src/modules/catalog/domain/errors.ts';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

let pool: Pool | undefined;
let shopRepo: PgShopRepository;
let categoryRepo: PgCategoryRepository;
let productRepo: PgProductRepository;
let variantRepo: PgProductVariantRepository;
let catalogPort: CatalogPortService;

// Stable test UUIDs
const testOwnerId = '00000000-0000-4000-b000-000000000001';
const testShopId = '00000000-0000-4000-a000-000000000001';
const testCatId1 = '00000000-0000-4000-c000-000000000001';
const testCatId2 = '00000000-0000-4000-c000-000000000002';
const testProdId1 = '00000000-0000-4000-d000-000000000001';
const testVarId1 = '00000000-0000-4000-e000-000000000001';

remoteDescribe('Catalog PostgreSQL Integration Tests (T2)', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 2 },
    });

    shopRepo = new PgShopRepository(pool);
    categoryRepo = new PgCategoryRepository(pool);
    productRepo = new PgProductRepository(pool);
    variantRepo = new PgProductVariantRepository(pool);
    catalogPort = new CatalogPortService({ pool });

    // Clean up test data if exists
    await pool.query('DELETE FROM product_variants WHERE product_id = $1', [testProdId1]);
    await pool.query('DELETE FROM product_images WHERE product_id = $1', [testProdId1]);
    await pool.query('DELETE FROM products WHERE product_id = $1', [testProdId1]);
    await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [testCatId1, testCatId2]);
    await pool.query('DELETE FROM shops WHERE shop_id = $1', [testShopId]);
    await pool.query('DELETE FROM app_users WHERE user_id = $1', [testOwnerId]);
    await pool.query('DELETE FROM auth.users WHERE id = $1', [testOwnerId]);

    // Insert mock user for FK: auth.users -> app_users
    await pool.query(
      `INSERT INTO auth.users (id, email)
       VALUES ($1, 'seller-test-catalog@example.com')
       ON CONFLICT (id) DO NOTHING`,
      [testOwnerId]
    );

    await pool.query(
      `INSERT INTO app_users (user_id, email, role, status)
       VALUES ($1, 'seller-test-catalog@example.com', 'SELLER', 'ACTIVE')
       ON CONFLICT (user_id) DO NOTHING`,
      [testOwnerId]
    );
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DELETE FROM product_variants WHERE product_id = $1', [testProdId1]);
      await pool.query('DELETE FROM product_images WHERE product_id = $1', [testProdId1]);
      await pool.query('DELETE FROM products WHERE product_id = $1', [testProdId1]);
      await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [testCatId1, testCatId2]);
      await pool.query('DELETE FROM shops WHERE shop_id = $1', [testShopId]);
      await pool.query('DELETE FROM app_users WHERE user_id = $1', [testOwnerId]);
      await pool.query('DELETE FROM auth.users WHERE id = $1', [testOwnerId]);

      await closeDatabasePool(pool);
    }
  }, 20_000);

  it('creates and reads Shop and Categories in PostgreSQL', async () => {
    const shop = await shopRepo.create({
      shopId: testShopId,
      ownerId: testOwnerId,
      shopName: 'Integration Shop',
      description: 'Shop for DB test',
      logoUrl: null,
      pickupAddress: '123 Integration Rd',
      contactPhone: '0901234567',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(shop.shopName).toBe('Integration Shop');

    const cat1 = await categoryRepo.create({
      categoryId: testCatId1,
      parentCategoryId: null,
      categoryName: 'Electronics DB',
      description: 'Root Category',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(cat1.categoryId).toBe(testCatId1);
    expect(cat1.categoryName).toBe('Electronics DB');

    const cat2 = await categoryRepo.create({
      categoryId: testCatId2,
      parentCategoryId: testCatId1,
      categoryName: 'Phones DB',
      description: 'Child Category',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(cat2.categoryId).toBe(testCatId2);
    expect(cat2.categoryName).toBe('Phones DB');
    expect(cat2.parentCategoryId).toBe(testCatId1);

    const roots = await categoryRepo.findRoots();
    expect(roots.some((r) => r.categoryId === testCatId1)).toBe(true);

    const children = await categoryRepo.findChildren(testCatId1);
    expect(children.some((c) => c.categoryId === testCatId2)).toBe(true);
  });

  it('creates Products and executes queryPublic with filter and visibility', async () => {
    await productRepo.create(
      {
        productId: testProdId1,
        shopId: testShopId,
        categoryId: testCatId2,
        productName: 'Galaxy S24 Ultra',
        description: 'AI Flagship',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        {
          variantId: testVarId1,
          productId: testProdId1,
          variantName: '256GB Titanium',
          variantValue: 'Titanium Black',
          sku: 'S24-TITANIUM-256',
          price: '999.00',
          stockQuantity: 20,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    );

    const queryRes = await productRepo.queryPublic({
      categoryId: testCatId2,
      search: 'galaxy',
      minPrice: 500,
      maxPrice: 1200,
      sortBy: 'price_desc',
    });

    expect(queryRes.total).toBeGreaterThanOrEqual(1);
    const found = queryRes.items.find((item) => item.productId === testProdId1);
    expect(found).toBeDefined();
    expect(found?.productName).toBe('Galaxy S24 Ultra');
    expect(found?.minPrice).toBe('999.00');
  });

  it('executes CatalogPortService.lockVariant with real PostgreSQL row-level lock', async () => {
    const lockResult = await catalogPort.lockVariant(testVarId1, 5);
    expect(lockResult.requestedQuantity).toBe(5);
    expect(lockResult.remainingStock).toBe(15);

    // Verify in DB directly
    const directVariant = await variantRepo.findById(testVarId1);
    expect(directVariant?.stockQuantity).toBe(15);
  });

  it('rejects lockVariant if stock is insufficient', async () => {
    await expect(catalogPort.lockVariant(testVarId1, 999)).rejects.toThrow(InventoryInsufficientError);
  });

  it('rolls back stock deduction if an outer transaction fails', async () => {
    if (!pool) throw new Error('Pool not initialized');

    try {
      await withTransaction(pool, async (client) => {
        await catalogPort.lockVariant(testVarId1, 3, client);
        throw new Error('Downstream payment failure simulation');
      });
    } catch (err: unknown) {
      expect((err as Error).message).toBe('Downstream payment failure simulation');
    }

    // After rollback, stock must remain 15, NOT 12!
    const directVariant = await variantRepo.findById(testVarId1);
    expect(directVariant?.stockQuantity).toBe(15);
  });
});
