import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CategoryEntity } from '../../../src/modules/catalog/domain/category.ts';
import { ShopEntity } from '../../../src/modules/catalog/domain/shop.ts';
import { ValidationError, ForbiddenError, SkuConflictError } from '../../../src/modules/catalog/domain/errors.ts';

describe('Catalog Domain: Category & Shop Ownership', () => {

  describe('Category Hierarchy (RB-KN04, Schema Freeze max 2 levels)', () => {
    it('[RB-KN04] Danh mục cấp 1: parentCategoryId là null', () => {
      const rootCat = new CategoryEntity({
        categoryId: 'cat-root-01',
        parentCategoryId: null,
        categoryName: 'Thời trang nam',
        description: 'Tất cả sản phẩm thời trang cho nam giới',
        status: 'ACTIVE',
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      });
      assert.equal(rootCat.parentCategoryId, null);
      assert.equal(rootCat.categoryName, 'Thời trang nam');
    });

    it('[RB-KN04] Danh mục cấp 2: parent trỏ tới danh mục cấp 1', () => {
      const subCat = new CategoryEntity({
        categoryId: 'cat-sub-01',
        parentCategoryId: 'cat-root-01',
        categoryName: 'Áo thun nam',
        description: 'Các mẫu áo thun basic và graphic',
        status: 'ACTIVE',
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
        parentDepth: 1, // cha là cấp 1 -> hợp lệ
      });
      assert.equal(subCat.parentCategoryId, 'cat-root-01');
    });

    it('[RB-KN04] Tạo danh mục cấp 3 (depth > 2) phải bị từ chối với ValidationError', () => {
      assert.throws(
        () =>
          new CategoryEntity({
            categoryId: 'cat-sub-sub-01',
            parentCategoryId: 'cat-sub-01',
            categoryName: 'Áo thun cổ tim',
            description: 'Danh mục cấp 3 vi phạm ràng buộc',
            status: 'ACTIVE',
            createdAt: '2026-09-16T10:00:00.000Z',
            updatedAt: '2026-09-16T10:00:00.000Z',
            parentDepth: 2, // cha đã là cấp 2 -> vi phạm
          }),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('Shop Ownership & SKU Isolation (QD04, RB-LB11)', () => {
    const shopParams = {
      shopId: 'shop-abc-123',
      ownerId: 'user-seller-1',
      shopName: 'Thời Trang Men Style',
      description: 'Chuyên đồ nam cao cấp',
      logoUrl: null,
      pickupAddress: '123 Đường Lê Lợi, Q1, TP.HCM',
      contactPhone: '0901234567',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
    };

    it('[QD04] Seller sở hữu Shop có quyền thao tác trên sản phẩm của Shop đó', () => {
      const shop = new ShopEntity(shopParams);
      assert.doesNotThrow(() => shop.assertOwnership('user-seller-1'));
    });

    it('[QD04] Seller khác (user-seller-2) cố tình thao tác trên Shop phải bị từ chối ForbiddenError', () => {
      const shop = new ShopEntity(shopParams);
      assert.throws(
        () => shop.assertOwnership('user-seller-2'),
        (err: unknown) => err instanceof ForbiddenError && err.code === 'RESOURCE_FORBIDDEN'
      );
    });

    it('[RB-LB11] SKU là duy nhất trong phạm vi từng Shop (trùng SKU trong cùng Shop ném SKU_CONFLICT)', () => {
      const shop = new ShopEntity({ ...shopParams, initialSkus: ['SKU-POLO-BLACK'] });

      // Đăng ký SKU mới -> Thành công
      assert.doesNotThrow(() => shop.registerSku('SKU-POLO-WHITE'));

      // Đăng ký lại SKU đã tồn tại trong Shop -> Bị chặn với SkuConflictError
      assert.throws(
        () => shop.registerSku('SKU-POLO-BLACK'),
        (err: unknown) => err instanceof SkuConflictError && err.code === 'SKU_CONFLICT'
      );
    });
  });

});
