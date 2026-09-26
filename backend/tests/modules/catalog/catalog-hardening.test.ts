import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../../db/client.js';
import {
  PgShopRepository,
  PgCategoryRepository,
  PgProductRepository,
} from '../../../src/modules/catalog/repositories/pg-catalog.repository.ts';
import { PgCatalogHttpService } from '../../../src/modules/catalog/services/pg-catalog-http.service.ts';
import {
  ForbiddenError,
  ResourceNotFoundError,
  SkuConflictError,
  StockInvalidError,
  ValidationError,
} from '../../../src/modules/catalog/domain/errors.ts';
import type { RequestContext } from '../../../src/contracts/request-context.contract.ts';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

let pool: Pool | undefined;
let catalogHttpService: PgCatalogHttpService;
let shopRepo: PgShopRepository;
let categoryRepo: PgCategoryRepository;
let productRepo: PgProductRepository;

// Stable UUIDs for hardening tests
const seller1UserId = '00000000-0000-4000-b000-000000000011';
const seller2UserId = '00000000-0000-4000-b000-000000000012';
const shop1Id = '00000000-0000-4000-a000-000000000011';
const shop2Id = '00000000-0000-4000-a000-000000000012';
const categoryActiveId = '00000000-0000-4000-c000-000000000011';
const categoryInactiveId = '00000000-0000-4000-c000-000000000012';

const contextSeller1: RequestContext = {
  request_id: 'req_seller1_t3',
  user_id: seller1UserId,
  role: 'SELLER',
  shop_id: shop1Id,
};

const contextSeller2: RequestContext = {
  request_id: 'req_seller2_t3',
  user_id: seller2UserId,
  role: 'SELLER',
  shop_id: shop2Id,
};

remoteDescribe('Catalog Domain Hardening & Security Tests (Mốc T3)', () => {
  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({
      databaseUrl: config.directUrl,
      pool: { ...config.pool, max: 5 },
    });

    catalogHttpService = new PgCatalogHttpService(pool);
    shopRepo = new PgShopRepository(pool);
    categoryRepo = new PgCategoryRepository(pool);
    productRepo = new PgProductRepository(pool);

    // Cleanup previous test fixtures
    await pool.query(
      `DELETE FROM product_variants WHERE product_id IN (
         SELECT product_id FROM products WHERE shop_id IN ($1, $2)
       )`,
      [shop1Id, shop2Id],
    );
    await pool.query(
      `DELETE FROM product_images WHERE product_id IN (
         SELECT product_id FROM products WHERE shop_id IN ($1, $2)
       )`,
      [shop1Id, shop2Id],
    );
    await pool.query('DELETE FROM products WHERE shop_id IN ($1, $2)', [shop1Id, shop2Id]);
    await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [categoryActiveId, categoryInactiveId]);
    await pool.query('DELETE FROM shops WHERE shop_id IN ($1, $2)', [shop1Id, shop2Id]);
    await pool.query('DELETE FROM app_users WHERE user_id IN ($1, $2)', [seller1UserId, seller2UserId]);
    await pool.query('DELETE FROM auth.users WHERE id IN ($1, $2)', [seller1UserId, seller2UserId]);

    // Create auth users & app users
    for (const [id, email] of [
      [seller1UserId, 'seller1-t3@example.com'],
      [seller2UserId, 'seller2-t3@example.com'],
    ]) {
      await pool.query(
        `INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
        [id, email],
      );
      await pool.query(
        `INSERT INTO app_users (user_id, email, role, status) VALUES ($1, $2, 'SELLER', 'ACTIVE') ON CONFLICT (user_id) DO NOTHING`,
        [id, email],
      );
    }

    // Create 2 separate shops (Seller 1 -> Shop 1, Seller 2 -> Shop 2)
    const now = new Date().toISOString();
    await shopRepo.create({
      shopId: shop1Id,
      ownerId: seller1UserId,
      shopName: 'Shop Alpha (Seller 1)',
      description: null,
      logoUrl: null,
      pickupAddress: '123 Alpha St',
      contactPhone: '0901234567',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    await shopRepo.create({
      shopId: shop2Id,
      ownerId: seller2UserId,
      shopName: 'Shop Beta (Seller 2)',
      description: null,
      logoUrl: null,
      pickupAddress: '456 Beta St',
      contactPhone: '0907654321',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    // Create active and inactive categories
    await categoryRepo.create({
      categoryId: categoryActiveId,
      parentCategoryId: null,
      categoryName: 'Danh mục Active T3',
      description: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });

    await categoryRepo.create({
      categoryId: categoryInactiveId,
      parentCategoryId: null,
      categoryName: 'Danh mục Inactive T3',
      description: null,
      status: 'INACTIVE',
      createdAt: now,
      updatedAt: now,
    });
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      // Clean up test data
      await pool.query(
        `DELETE FROM product_variants WHERE product_id IN (
           SELECT product_id FROM products WHERE shop_id IN ($1, $2)
         )`,
        [shop1Id, shop2Id],
      );
      await pool.query(
        `DELETE FROM product_images WHERE product_id IN (
           SELECT product_id FROM products WHERE shop_id IN ($1, $2)
         )`,
        [shop1Id, shop2Id],
      );
      await pool.query('DELETE FROM products WHERE shop_id IN ($1, $2)', [shop1Id, shop2Id]);
      await pool.query('DELETE FROM categories WHERE category_id IN ($1, $2)', [categoryActiveId, categoryInactiveId]);
      await pool.query('DELETE FROM shops WHERE shop_id IN ($1, $2)', [shop1Id, shop2Id]);
      await pool.query('DELETE FROM app_users WHERE user_id IN ($1, $2)', [seller1UserId, seller2UserId]);
      await pool.query('DELETE FROM auth.users WHERE id IN ($1, $2)', [seller1UserId, seller2UserId]);

      await closeDatabasePool(pool);
    }
  }, 20_000);

interface ProductCreatedResponse {
  product_id: string;
  shop_id: string;
  category_id: string;
  product_name: string;
  status: string;
  variants: Array<{
    variant_id: string;
    variant_name: string;
    sku: string;
    price: string;
    stock_quantity: number;
  }>;
}

interface VariantStockUpdateResponse {
  variant_id: string;
  stock_quantity: number;
}

  describe('1. Negative Ownership & Cross-Shop Access [QD04, RB-LQH07]', () => {
    let createdProduct1: ProductCreatedResponse;
    let variant1Id: string;

    beforeAll(async () => {
      // Seller 1 creates product in Shop 1
      createdProduct1 = (await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryActiveId,
        product_name: 'Bàn phím cơ Shop 1',
        description: 'Bàn phím cơ chất lượng cao',
        variants: [
          {
            variant_name: 'Red Switch',
            variant_value: 'Red',
            sku: 'KB-SHOP1-RED',
            price: '1500000.00',
            stock_quantity: 50,
          },
        ],
      })) as ProductCreatedResponse;
      variant1Id = createdProduct1.variants[0].variant_id;
    });

    it('allows Seller 1 to update stock of its own variant in Shop 1', async () => {
      const result = (await catalogHttpService.updateVariantStock(contextSeller1, variant1Id, {
        quantity: 75,
      })) as VariantStockUpdateResponse;
      expect(result.variant_id).toBe(variant1Id);
      expect(result.stock_quantity).toBe(75);
    }, 30_000);

    it('blocks Seller 2 from updating stock of Seller 1 variant with RESOURCE_FORBIDDEN (403)', async () => {
      await expect(
        catalogHttpService.updateVariantStock(contextSeller2, variant1Id, {
          quantity: 10,
        }),
      ).rejects.toThrowError(ForbiddenError);

      await expect(
        catalogHttpService.updateVariantStock(contextSeller2, variant1Id, {
          quantity: 10,
        }),
      ).rejects.toThrow(/Variant belongs to another shop/);
    }, 30_000);

    it('blocks updating stock when caller context lacks shop_id with ForbiddenError (403)', async () => {
      const invalidContext: RequestContext = {
        request_id: 'req_invalid_t3',
        user_id: seller1UserId,
        role: 'BUYER',
      };
      await expect(
        catalogHttpService.updateVariantStock(invalidContext, variant1Id, {
          quantity: 20,
        }),
      ).rejects.toThrowError(ForbiddenError);
    }, 30_000);

    it('rejects updating stock with negative quantity with StockInvalidError (QD06)', async () => {
      await expect(
        catalogHttpService.updateVariantStock(contextSeller1, variant1Id, {
          quantity: -5,
        }),
      ).rejects.toThrowError(StockInvalidError);
    }, 30_000);

    it('returns ResourceNotFoundError (404) when updating non-existent variantId', async () => {
      const fakeVariantId = '00000000-0000-4000-e000-999999999999';
      await expect(
        catalogHttpService.updateVariantStock(contextSeller1, fakeVariantId, {
          quantity: 10,
        }),
      ).rejects.toThrowError(ResourceNotFoundError);
    }, 30_000);
  });

  describe('2. SKU Conflict & Scope Isolation [RB-LB11]', () => {
    it('serializes concurrent product creation with the same SKU in one Shop', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const concurrentSku = `SKU-RACE-${Date.now()}`;
      const now = new Date().toISOString();
      const makeProduct = (suffix: string) => {
        const productId = crypto.randomUUID();
        return {
          product: {
            productId,
            shopId: shop1Id,
            categoryId: categoryActiveId,
            productName: `Concurrent product ${suffix}`,
            description: null,
            status: 'ACTIVE' as const,
            createdAt: now,
            updatedAt: now,
          },
          variants: [{
            variantId: crypto.randomUUID(),
            productId,
            variantName: 'Default',
            variantValue: null,
            sku: concurrentSku,
            price: '100000.00',
            stockQuantity: 1,
            status: 'ACTIVE' as const,
            createdAt: now,
            updatedAt: now,
          }],
        };
      };

      const first = makeProduct('A');
      const second = makeProduct('B');
      const results = await Promise.allSettled([
        new PgProductRepository(pool).create(first.product, first.variants),
        new PgProductRepository(pool).create(second.product, second.variants),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const failure = results.find((result) => result.status === 'rejected');
      expect(failure).toBeDefined();
      if (failure?.status === 'rejected') expect(failure.reason).toBeInstanceOf(SkuConflictError);

      const persisted = await pool.query<{ count: string }>(
        `SELECT count(*)::text AS count
           FROM product_variants v
           JOIN products p ON p.product_id = v.product_id
          WHERE p.shop_id = $1 AND v.sku = $2`,
        [shop1Id, concurrentSku],
      );
      expect(Number(persisted.rows[0].count)).toBe(1);
    }, 30_000);

    it('rejects creating product with duplicate SKUs inside the same request payload', async () => {
      await expect(
        catalogHttpService.createProduct(contextSeller1, {
          category_id: categoryActiveId,
          product_name: 'Áo thun đa màu',
          variants: [
            {
              variant_name: 'Màu Đỏ',
              sku: 'TSHIRT-DUP-01',
              price: '200000.00',
              stock_quantity: 10,
            },
            {
              variant_name: 'Màu Xanh',
              sku: 'TSHIRT-DUP-01', // Trùng SKU trong cùng payload
              price: '200000.00',
              stock_quantity: 10,
            },
          ],
        }),
      ).rejects.toThrowError(SkuConflictError);
    }, 30_000);

    it('rejects creating product with SKU that already exists in the same Shop', async () => {
      // Create first product with SKU-UNIQUE-1
      await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryActiveId,
        product_name: 'Chuột Gaming Shop 1',
        variants: [
          {
            variant_name: 'Bản Chuẩn',
            sku: 'MOUSE-GAMING-01',
            price: '500000.00',
            stock_quantity: 20,
          },
        ],
      });

      // Attempt to create another product in Shop 1 with same SKU
      await expect(
        catalogHttpService.createProduct(contextSeller1, {
          category_id: categoryActiveId,
          product_name: 'Chuột Gaming Phụ kiện',
          variants: [
            {
              variant_name: 'Bản Đen',
              sku: 'MOUSE-GAMING-01', // Trùng SKU trong Shop 1
              price: '520000.00',
              stock_quantity: 15,
            },
          ],
        }),
      ).rejects.toThrowError(SkuConflictError);
    }, 30_000);

    it('allows different Shops to have the identical SKU without conflict', async () => {
      // Seller 2 in Shop 2 creates product with the SAME SKU as Shop 1
      const shop2Product = (await catalogHttpService.createProduct(contextSeller2, {
        category_id: categoryActiveId,
        product_name: 'Chuột Gaming của Shop 2',
        variants: [
          {
            variant_name: 'Bản Nhập Khẩu',
            sku: 'MOUSE-GAMING-01', // Cùng SKU nhưng khác Shop
            price: '480000.00',
            stock_quantity: 30,
          },
        ],
      })) as ProductCreatedResponse;

      expect(shop2Product).toBeDefined();
      expect(shop2Product.shop_id).toBe(shop2Id);
      expect(shop2Product.variants[0].sku).toBe('MOUSE-GAMING-01');
    }, 30_000);

    it('blocks concurrent createProduct requests with identical Shop and SKU (T3-P3-01)', async () => {
      const concurrentSku = `CONCURRENT-SKU-${Date.now()}`;
      const payload = {
        category_id: categoryActiveId,
        product_name: 'Bàn phím cơ Concurrency Test',
        variants: [
          {
            variant_name: 'Blue Switch',
            sku: concurrentSku,
            price: '1200000.00',
            stock_quantity: 25,
          },
        ],
      };

      // Two simultaneous createProduct requests for Seller 1 (same shop & SKU)
      const results = await Promise.allSettled([
        catalogHttpService.createProduct(contextSeller1, payload),
        catalogHttpService.createProduct(contextSeller1, payload),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Exactly one succeeds, the other receives SKU_CONFLICT
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedReason).toBeInstanceOf(SkuConflictError);
      expect(rejectedReason.code).toBe('SKU_CONFLICT');
      expect(rejectedReason.message).toMatch(/already exists in this shop/);

      // Verify in PostgreSQL DB that exactly ONE variant with this SKU exists in Shop 1
      const countRes = await pool!.query(
        `SELECT COUNT(*) AS count
         FROM product_variants v
         JOIN products p ON v.product_id = p.product_id
         WHERE p.shop_id = $1 AND v.sku = $2`,
        [shop1Id, concurrentSku],
      );
      expect(Number(countRes.rows[0].count)).toBe(1);
    }, 30_000);

    it('verifies PostgreSQL concurrency synchronization using two distinct PoolClients (T3-P3-01)', async () => {
      const client1 = await pool!.connect();
      const client2 = await pool!.connect();
      const poolSku = `POOLCLIENT-SKU-${Date.now()}`;
      const payload = {
        category_id: categoryActiveId,
        product_name: 'Chuột Concurrency PoolClient',
        variants: [
          {
            variant_name: 'Pool Edition',
            sku: poolSku,
            price: '350000.00',
            stock_quantity: 15,
          },
        ],
      };

      try {
        await client1.query('BEGIN');
        await client2.query('BEGIN');

        const p1 = (catalogHttpService.createProduct(contextSeller1, payload, client1) as Promise<ProductCreatedResponse>)
          .then(async (res) => {
            await client1.query('COMMIT');
            return res;
          })
          .catch(async (err) => {
            await client1.query('ROLLBACK');
            throw err;
          });

        const p2 = (catalogHttpService.createProduct(contextSeller1, payload, client2) as Promise<ProductCreatedResponse>)
          .then(async (res) => {
            await client2.query('COMMIT');
            return res;
          })
          .catch(async (err) => {
            await client2.query('ROLLBACK');
            throw err;
          });

        const results = await Promise.allSettled([p1, p2]);
        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(1);

        const rejectedReason = (rejected[0] as PromiseRejectedResult).reason;
        expect(rejectedReason).toBeInstanceOf(SkuConflictError);
        expect(rejectedReason.code).toBe('SKU_CONFLICT');

        // Confirm exactly one variant created in DB
        const countRes = await pool!.query(
          `SELECT COUNT(*) AS count
           FROM product_variants v
           JOIN products p ON v.product_id = p.product_id
           WHERE p.shop_id = $1 AND v.sku = $2`,
          [shop1Id, poolSku],
        );
        expect(Number(countRes.rows[0].count)).toBe(1);
      } finally {
        client1.release();
        client2.release();
      }
    }, 30_000);
  });

  describe('3. Media Validation & Ordering [RB-MG11]', () => {
    it('rejects product creation when image sort_order is negative', async () => {
      await expect(
        catalogHttpService.createProduct(contextSeller1, {
          category_id: categoryActiveId,
          product_name: 'Sản phẩm lỗi ảnh âm',
          variants: [
            {
              variant_name: 'Bản 1',
              sku: 'IMG-TEST-01',
              price: '100000.00',
              stock_quantity: 10,
            },
          ],
          images: [
            {
              image_url: 'https://storage.example.com/img1.jpg',
              sort_order: -1, // Lỗi RB-MG11
            },
          ],
        }),
      ).rejects.toThrowError(ValidationError);
    }, 30_000);

    it('rejects product creation when image sort_order is not an integer', async () => {
      await expect(
        catalogHttpService.createProduct(contextSeller1, {
          category_id: categoryActiveId,
          product_name: 'Sản phẩm lỗi ảnh số thực',
          variants: [
            {
              variant_name: 'Bản 1',
              sku: 'IMG-TEST-02',
              price: '100000.00',
              stock_quantity: 10,
            },
          ],
          images: [
            {
              image_url: 'https://storage.example.com/img2.jpg',
              sort_order: 1.5, // Số thực
            },
          ],
        }),
      ).rejects.toThrowError(ValidationError);
    }, 30_000);
  });

  describe('4. Status Visibility Matrix [RB-MG12]', () => {
    it('ensures only ACTIVE products belonging to ACTIVE shop and ACTIVE category are visible to public', async () => {
      // 1. Product ACTIVE in ACTIVE category & shop
      const activeProd = (await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryActiveId,
        product_name: 'Sản phẩm hoàn toàn hợp lệ hiển thị',
        variants: [
          {
            variant_name: 'Var A',
            sku: 'VIS-ACTIVE-01',
            price: '120000.00',
            stock_quantity: 10,
          },
        ],
      })) as ProductCreatedResponse;

      // 2. Product in INACTIVE category
      const inactiveCatProd = (await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryInactiveId,
        product_name: 'Sản phẩm thuộc danh mục ẩn',
        variants: [
          {
            variant_name: 'Var B',
            sku: 'VIS-INACT-CAT-01',
            price: '150000.00',
            stock_quantity: 10,
          },
        ],
      })) as ProductCreatedResponse;

      // 3. Product with status INACTIVE
      const draftProd = (await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryActiveId,
        product_name: 'Sản phẩm tạm thời bị ẩn',
        variants: [
          {
            variant_name: 'Var C',
            sku: 'VIS-DRAFT-01',
            price: '180000.00',
            stock_quantity: 10,
          },
        ],
      })) as ProductCreatedResponse;
      await productRepo.updateStatus(draftProd.product_id, 'INACTIVE');

      // Query public catalog
      const publicResult = await catalogHttpService.listProducts({
        search: 'Sản phẩm',
      });

      const returnedIds = publicResult.items.map((i: { product_id: string }) => i.product_id);
      expect(returnedIds).toContain(activeProd.product_id);
      expect(returnedIds).not.toContain(inactiveCatProd.product_id);
      expect(returnedIds).not.toContain(draftProd.product_id);

      // getProduct Public Detail API Visibility [Issue 1 fix verification]
      // 1. ACTIVE product in ACTIVE shop & category must return 200 (success)
      const detail = (await catalogHttpService.getProduct(activeProd.product_id)) as ProductCreatedResponse;
      expect(detail).toBeDefined();
      expect(detail.product_id).toBe(activeProd.product_id);
      expect(detail.status).toBe('ACTIVE');
      expect(detail.variants.length).toBeGreaterThan(0);

      // 2. DRAFT / INACTIVE product must throw ResourceNotFoundError (HTTP 404)
      await expect(
        catalogHttpService.getProduct(draftProd.product_id),
      ).rejects.toThrowError(ResourceNotFoundError);

      // 3. Product in INACTIVE category must throw ResourceNotFoundError (HTTP 404)
      await expect(
        catalogHttpService.getProduct(inactiveCatProd.product_id),
      ).rejects.toThrowError(ResourceNotFoundError);

      // 4. Non-existent product must throw ResourceNotFoundError (HTTP 404)
      await expect(
        catalogHttpService.getProduct('00000000-0000-4000-8000-000000000000'),
      ).rejects.toThrowError(ResourceNotFoundError);
    }, 30_000);

    it('denies public getProduct when the owning Shop is SUSPENDED or not ACTIVE', async () => {
      // Create product in Shop 2
      const prod = (await catalogHttpService.createProduct(contextSeller2, {
        category_id: categoryActiveId,
        product_name: 'Sản phẩm của Shop 2 sẽ bị tạm dừng',
        variants: [
          {
            variant_name: 'Var Temp',
            sku: 'SHOP2-TEMP-01',
            price: '200000.00',
            stock_quantity: 10,
          },
        ],
      })) as ProductCreatedResponse;

      // Suspend shop 2
      await shopRepo.updateStatus(shop2Id, 'SUSPENDED');

      // Public getProduct must return 404
      await expect(
        catalogHttpService.getProduct(prod.product_id),
      ).rejects.toThrowError(ResourceNotFoundError);

      // Restore shop 2 to ACTIVE
      await shopRepo.updateStatus(shop2Id, 'ACTIVE');

      // After restoring shop to ACTIVE, public getProduct works again
      const restored = (await catalogHttpService.getProduct(prod.product_id)) as ProductCreatedResponse;
      expect(restored.product_id).toBe(prod.product_id);
    }, 30_000);
  });

  describe('5. Soft Deactivation [QD16]', () => {
    it('updates product status to INACTIVE instead of physical deletion', async () => {
      const prod = (await catalogHttpService.createProduct(contextSeller1, {
        category_id: categoryActiveId,
        product_name: 'Sản phẩm kiểm tra soft delete',
        variants: [
          {
            variant_name: 'Var Soft',
            sku: 'SOFT-DEL-01',
            price: '90000.00',
            stock_quantity: 5,
          },
        ],
      })) as ProductCreatedResponse;

      const updated = await productRepo.updateStatus(prod.product_id, 'INACTIVE');
      expect(updated.status).toBe('INACTIVE');

      // Row still exists in DB
      const dbCheck = await productRepo.findById(prod.product_id);
      expect(dbCheck).not.toBeNull();
      expect(dbCheck?.status).toBe('INACTIVE');
    }, 30_000);
  });

  describe('6. Cursor & Pagination Input Validation [Issue 2]', () => {
    it('throws ValidationError (VALIDATION_FAILED) instead of 500 when cursor is invalid', async () => {
      await expect(
        catalogHttpService.listProducts({ cursor: 'not-a-cursor' }),
      ).rejects.toThrowError(ValidationError);

      try {
        await catalogHttpService.listProducts({ cursor: 'not-a-cursor' });
        expect.fail('Should have thrown ValidationError');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).code).toBe('VALIDATION_FAILED');
      }
    }, 30_000);
  });
});
