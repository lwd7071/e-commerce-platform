import { describe, it, expect } from 'vitest';
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
      expect(rootCat.parentCategoryId).toBeNull();
      expect(rootCat.categoryName).toBe('Thời trang nam');
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
        parentDepth: 1,
      });
      expect(subCat.parentCategoryId).toBe('cat-root-01');
    });

    it('[RB-KN04] Tạo danh mục cấp 3 (depth > 2) phải bị từ chối với ValidationError', () => {
      expect(
        () =>
          new CategoryEntity({
            categoryId: 'cat-sub-sub-01',
            parentCategoryId: 'cat-sub-01',
            categoryName: 'Áo thun cổ tim',
            description: 'Danh mục cấp 3 vi phạm ràng buộc',
            status: 'ACTIVE',
            createdAt: '2026-09-16T10:00:00.000Z',
            updatedAt: '2026-09-16T10:00:00.000Z',
            parentDepth: 2,
          })
      ).toThrow(ValidationError);
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
      expect(() => shop.assertOwnership('user-seller-1')).not.toThrow();
    });

    it('[QD04] Seller khác (user-seller-2) cố tình thao tác trên Shop phải bị từ chối ForbiddenError', () => {
      const shop = new ShopEntity(shopParams);
      expect(() => shop.assertOwnership('user-seller-2')).toThrow(ForbiddenError);
    });

    it('[RB-LB11] SKU là duy nhất trong phạm vi từng Shop (trùng SKU trong cùng Shop ném SKU_CONFLICT)', () => {
      const shop = new ShopEntity({ ...shopParams, initialSkus: ['SKU-POLO-BLACK'] });

      expect(() => shop.registerSku('SKU-POLO-WHITE')).not.toThrow();
      expect(() => shop.registerSku('SKU-POLO-BLACK')).toThrow(SkuConflictError);
    });
  });

});
