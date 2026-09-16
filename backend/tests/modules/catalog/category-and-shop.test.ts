import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CategoryEntity } from '../../../src/modules/catalog/domain/category';
import { ShopEntity } from '../../../src/modules/catalog/domain/shop';
import { ValidationError, ForbiddenError, SkuConflictError } from '../../../src/modules/catalog/domain/errors';

describe('Catalog Domain: Category & Shop Ownership', () => {

  describe('Category Hierarchy (RB-KN04, Schema Freeze max 2 levels)', () => {
    it('[RB-KN04] Danh mục cấp 1: parentCategoryId là null', () => {
      const rootCat = new CategoryEntity({
        categoryId: 'cat-root-1',
        parentCategoryId: null,
        categoryName: 'Thời trang nam',
        description: 'Ngành hàng thời trang nam giới',
        status: 'ACTIVE',
        depth: 1,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });
      assert.equal(rootCat.parentCategoryId, null);
      assert.equal(rootCat.depth, 1);
    });

    it('[RB-KN04] Danh mục cấp 2: parent trỏ tới danh mục cấp 1', () => {
      const subCat = new CategoryEntity({
        categoryId: 'cat-sub-2',
        parentCategoryId: 'cat-root-1',
        categoryName: 'Áo thun nam',
        description: 'Áo thun các loại',
        status: 'ACTIVE',
        depth: 2,
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });
      assert.equal(subCat.parentCategoryId, 'cat-root-1');
      assert.equal(subCat.depth, 2);
    });

    it('[RB-KN04] Tạo danh mục cấp 3 (depth > 2) phải bị từ chối với ValidationError', () => {
      assert.throws(
        () => new CategoryEntity({
          categoryId: 'cat-sub-3',
          parentCategoryId: 'cat-sub-2',
          categoryName: 'Áo thun cổ tròn',
          description: 'Cấp 3 vượt quá MVP',
          status: 'ACTIVE',
          depth: 3,
          createdAt: '2026-09-16T10:00:00.000Z',
          updatedAt: '2026-09-16T10:00:00.000Z',
        }),
        (err: any) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('Shop Ownership & SKU Isolation (QD04, RB-LB11)', () => {
    const shopParams = {
      shopId: 'shop-seller-1',
      ownerId: 'user-seller-1',
      shopName: 'Shop Thời Trang Nam Đẹp',
      description: 'Chuyên sỉ lẻ quần áo nam',
      logoUrl: null,
      pickupAddress: '123 Võ Văn Ngân, TP. Thủ Đức',
      contactPhone: '0901234567',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
    };

    it('[QD04] Seller sở hữu Shop có quyền thao tác trên sản phẩm của Shop đó', () => {
      const shop = new ShopEntity(shopParams);
      // Kiểm tra quyền sở hữu với chính ownerId
      assert.doesNotThrow(() => shop.assertOwner('user-seller-1'));
    });

    it('[QD04] Seller khác (user-seller-2) cố tình thao tác trên Shop phải bị từ chối ForbiddenError', () => {
      const shop = new ShopEntity(shopParams);
      assert.throws(
        () => shop.assertOwner('user-seller-2'),
        (err: any) => err instanceof ForbiddenError && err.code === 'RESOURCE_FORBIDDEN'
      );
    });

    it('[RB-LB11] SKU là duy nhất trong phạm vi từng Shop (trùng SKU trong cùng Shop ném SKU_CONFLICT)', () => {
      const shop = new ShopEntity(shopParams);
      shop.registerSku('AO-THUN-DEN-L');
      
      // Thêm cùng SKU vào cùng Shop -> lỗi
      assert.throws(
        () => shop.registerSku('AO-THUN-DEN-L'),
        (err: any) => err instanceof SkuConflictError && err.code === 'SKU_CONFLICT'
      );

      // Thêm SKU khác vào Shop -> thành công
      assert.doesNotThrow(() => shop.registerSku('AO-THUN-TRANG-M'));
    });
  });

});
