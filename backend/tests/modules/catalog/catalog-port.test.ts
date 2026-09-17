import { describe, it, expect, beforeEach } from 'vitest';
import { CatalogPortService } from '../../../src/modules/catalog/services/catalog-port.service.ts';
import { ProductVariantEntity } from '../../../src/modules/catalog/domain/product-variant.ts';
import { InventoryInsufficientError, ValidationError } from '../../../src/modules/catalog/domain/errors.ts';

describe('Catalog Port Contract (Bàn giao cho Người 5 - Transaction Core)', () => {
  let catalogService: CatalogPortService;

  beforeEach(() => {
    catalogService = new CatalogPortService();

    catalogService.registerMockVariant(
      new ProductVariantEntity({
        variantId: 'variant-101',
        productId: 'prod-001',
        variantName: 'Màu',
        variantValue: 'Xanh - L',
        sku: 'AO-XANH-L',
        price: '199000.00',
        stockQuantity: 10,
        status: 'ACTIVE',
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      })
    );

    catalogService.registerMockVariant(
      new ProductVariantEntity({
        variantId: 'variant-102',
        productId: 'prod-002',
        variantName: 'Size',
        variantValue: 'XL',
        sku: 'AO-XL',
        price: '150000.00',
        stockQuantity: 5,
        status: 'ACTIVE',
        createdAt: '2026-09-16T10:00:00.000Z',
        updatedAt: '2026-09-16T10:00:00.000Z',
      })
    );

    catalogService.registerMockShop('shop-001', 'ACTIVE');
    catalogService.registerMockShop('shop-locked', 'LOCKED');
  });

  describe('Đọc thông tin giá & tồn kho phục vụ Checkout', () => {
    it('Đọc giá snapshot và tồn kho khả dụng của biến thể hợp lệ', async () => {
      const info = await catalogService.getVariantPriceAndStock('variant-101');
      expect(info.variantId).toBe('variant-101');
      expect(info.price).toBe('199000.00');
      expect(info.stockQuantity).toBe(10);
      expect(info.status).toBe('ACTIVE');
    });

    it('Yêu cầu biến thể không tồn tại phải ném ValidationError (RESOURCE_NOT_FOUND)', async () => {
      await expect(catalogService.getVariantPriceAndStock('variant-non-existent')).rejects.toThrow(ValidationError);
    });
  });

  describe('Khóa biến thể và kiểm tra tồn kho [QD07]', () => {
    it('[QD07] Đặt số lượng 4 khi kho có 10 -> thành công, kho còn lại 6', async () => {
      const result = await catalogService.lockVariant('variant-101', 4);
      expect(result.variantId).toBe('variant-101');
      expect(result.priceSnapshot).toBe('199000.00');
      expect(result.remainingStock).toBe(6);
    });

    it('[QD07] Đặt số lượng 15 khi kho chỉ có 10 -> ném InventoryInsufficientError (INVENTORY_INSUFFICIENT)', async () => {
      await expect(catalogService.lockVariant('variant-101', 15)).rejects.toThrow(InventoryInsufficientError);
    });

    it('[QD07] Đặt số lượng âm (-2) phải bị từ chối với ValidationError và KHÔNG làm tăng tồn kho', async () => {
      await expect(catalogService.lockVariant('variant-102', -2)).rejects.toThrow(ValidationError);
      const info = await catalogService.getVariantPriceAndStock('variant-102');
      expect(info.stockQuantity).toBe(5);
    });

    it('[QD07] Đặt số lượng lẻ (0.5) hoặc bằng 0 phải bị từ chối với ValidationError', async () => {
      await expect(catalogService.lockVariant('variant-102', 0.5)).rejects.toThrow(ValidationError);
      await expect(catalogService.lockVariant('variant-102', 0)).rejects.toThrow(ValidationError);
      const info = await catalogService.getVariantPriceAndStock('variant-102');
      expect(info.stockQuantity).toBe(5);
    });
  });

  describe('Kiểm tra trạng thái Shop', () => {
    it('Shop ACTIVE -> trả về true', async () => {
      const isActive = await catalogService.checkShopActive('shop-001');
      expect(isActive).toBe(true);
    });

    it('Shop LOCKED hoặc SUSPENDED -> trả về false', async () => {
      const isActive = await catalogService.checkShopActive('shop-locked');
      expect(isActive).toBe(false);
    });
  });

});
