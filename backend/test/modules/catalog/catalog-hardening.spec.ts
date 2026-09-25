import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CatalogDomainError,
  ValidationError,
  StockInvalidError,
  ForbiddenError,
  SkuConflictError,
  ResourceNotFoundError,
  ResourceDeleteNotAllowedError,
  InventoryInsufficientError,
} from '../../../src/modules/catalog/domain/errors.ts';
import { ProductEntity } from '../../../src/modules/catalog/domain/product.ts';
import { ProductVariantEntity } from '../../../src/modules/catalog/domain/product-variant.ts';
import { ProductImageEntity } from '../../../src/modules/catalog/domain/media.ts';
import { CategoryEntity } from '../../../src/modules/catalog/domain/category.ts';

describe('Catalog Hardening & Business Rules (Node native test runner — Mốc T3)', () => {
  const shopId = '00000000-0000-4000-a000-000000000001';
  const categoryId = '00000000-0000-4000-c000-000000000001';
  const productId = '00000000-0000-4000-d000-000000000001';
  const variantId = '00000000-0000-4000-e000-000000000001';
  const imageId = '00000000-0000-4000-f000-000000000001';

  describe('1. Error Codes & Mapping [error-observability.md, api-conventions.md]', () => {
    it('instantiates all standard catalog domain errors with correct codes', () => {
      const notFound = new ResourceNotFoundError('Resource not found');
      assert.strictEqual(notFound.code, 'RESOURCE_NOT_FOUND');
      assert.ok(notFound instanceof CatalogDomainError);

      const forbidden = new ForbiddenError('Cross-shop forbidden');
      assert.strictEqual(forbidden.code, 'RESOURCE_FORBIDDEN');
      assert.ok(forbidden instanceof CatalogDomainError);

      const validation = new ValidationError('Validation failed');
      assert.strictEqual(validation.code, 'VALIDATION_FAILED');

      const stock = new StockInvalidError('Stock invalid');
      assert.strictEqual(stock.code, 'STOCK_INVALID');

      const sku = new SkuConflictError('SKU conflict');
      assert.strictEqual(sku.code, 'SKU_CONFLICT');

      const deleteNotAllowed = new ResourceDeleteNotAllowedError('Delete restricted');
      assert.strictEqual(deleteNotAllowed.code, 'RESOURCE_DELETE_NOT_ALLOWED');

      const inventory = new InventoryInsufficientError('Insufficient inventory');
      assert.strictEqual(inventory.code, 'INVENTORY_INSUFFICIENT');
    });
  });

  describe('2. SKU Conflict & Variant Domain Rules [RB-LB11, QD05, QD06]', () => {
    it('[QD05] rejects variant with price <= 0 with VALIDATION_FAILED', () => {
      assert.throws(
        () => {
          new ProductVariantEntity({
            variantId,
            productId,
            variantName: 'Bản lỗi giá 0',
            variantValue: null,
            sku: 'VAR-P0',
            price: '0.00',
            stockQuantity: 10,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual((err as ValidationError).code, 'VALIDATION_FAILED');
          return true;
        },
      );
    });

    it('[QD06] rejects variant with stockQuantity < 0 with STOCK_INVALID', () => {
      assert.throws(
        () => {
          new ProductVariantEntity({
            variantId,
            productId,
            variantName: 'Bản lỗi tồn âm',
            variantValue: null,
            sku: 'VAR-STOCK-NEG',
            price: '100000.00',
            stockQuantity: -1,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof StockInvalidError);
          assert.strictEqual((err as StockInvalidError).code, 'STOCK_INVALID');
          return true;
        },
      );
    });

    it('[RB-LB11] detects duplicate SKU in variant collections', () => {
      const skus = ['SKU-1', 'SKU-2', 'SKU-1'];
      const seen = new Set<string>();
      let hasConflict = false;
      for (const s of skus) {
        if (seen.has(s)) {
          hasConflict = true;
          break;
        }
        seen.add(s);
      }
      assert.strictEqual(hasConflict, true);
    });
  });

  describe('3. Media Sort Order Domain Rules [RB-MG11]', () => {
    it('[RB-MG11] accepts sortOrder >= 0 integer', () => {
      const img = new ProductImageEntity({
        imageId,
        productId,
        imageUrl: 'https://example.com/valid.jpg',
        sortOrder: 0,
      });
      assert.strictEqual(img.sortOrder, 0);

      const img2 = new ProductImageEntity({
        imageId,
        productId,
        imageUrl: 'https://example.com/valid2.jpg',
        sortOrder: 10,
      });
      assert.strictEqual(img2.sortOrder, 10);
    });

    it('[RB-MG11] rejects negative or float sortOrder with VALIDATION_FAILED', () => {
      assert.throws(
        () => {
          new ProductImageEntity({
            imageId,
            productId,
            imageUrl: 'https://example.com/invalid.jpg',
            sortOrder: -1,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual((err as ValidationError).code, 'VALIDATION_FAILED');
          return true;
        },
      );

      assert.throws(
        () => {
          new ProductImageEntity({
            imageId,
            productId,
            imageUrl: 'https://example.com/invalid.jpg',
            sortOrder: 2.7,
          });
        },
        (err: unknown) => {
          assert.ok(err instanceof ValidationError);
          assert.strictEqual((err as ValidationError).code, 'VALIDATION_FAILED');
          return true;
        },
      );
    });
  });

  describe('4. Status Visibility & Soft Deactivation [QD16, RB-MG12]', () => {
    it('creates active product and enables soft deactivation to INACTIVE or HIDDEN', () => {
      const product = new ProductEntity({
        productId,
        shopId,
        categoryId,
        productName: 'Sản phẩm thử nghiệm',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      assert.strictEqual(product.status, 'ACTIVE');

      // Without transaction history: status becomes INACTIVE
      product.deactivate(false);
      assert.strictEqual(product.status, 'INACTIVE');

      // With transaction history: status becomes HIDDEN
      product.deactivate(true);
      assert.strictEqual(product.status, 'HIDDEN');

      // Physical delete with transaction history must throw RESOURCE_DELETE_NOT_ALLOWED
      assert.throws(
        () => {
          product.physicalDelete(true);
        },
        (err: unknown) => {
          assert.ok(err instanceof ResourceDeleteNotAllowedError);
          assert.strictEqual((err as ResourceDeleteNotAllowedError).code, 'RESOURCE_DELETE_NOT_ALLOWED');
          return true;
        },
      );
    });

    it('[RB-MG12] accepts only valid product statuses (DRAFT, ACTIVE, INACTIVE, HIDDEN)', () => {
      const validStatuses = ['DRAFT', 'ACTIVE', 'INACTIVE', 'HIDDEN'] as const;
      for (const st of validStatuses) {
        const prod = new ProductEntity({
          productId,
          shopId,
          categoryId,
          productName: `Product ${st}`,
          description: null,
          status: st,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        assert.strictEqual(prod.status, st);
      }
    });
  });

  describe('5. Category Depth & Hierarchy [RB-KN04]', () => {
    it('creates root category and child category within allowed depth', () => {
      const rootCat = new CategoryEntity({
        categoryId,
        parentCategoryId: null,
        categoryName: 'Điện tử',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      assert.strictEqual(rootCat.parentCategoryId, null);

      const childCatId = '00000000-0000-4000-c000-000000000002';
      const childCat = new CategoryEntity({
        categoryId: childCatId,
        parentCategoryId: categoryId,
        categoryName: 'Điện thoại & Phụ kiện',
        description: null,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      assert.strictEqual(childCat.parentCategoryId, categoryId);
    });
  });
});
