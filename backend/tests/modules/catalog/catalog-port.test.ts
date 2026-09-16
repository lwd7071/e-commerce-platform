import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { CatalogPortService } from '../../../src/modules/catalog/services/catalog-port.service';
import { ProductVariantEntity } from '../../../src/modules/catalog/domain/product-variant';
import { InventoryInsufficientError, ValidationError } from '../../../src/modules/catalog/domain/errors';

describe('Catalog Port Contract (Bàn giao cho Người 5 - Transaction Core)', () => {
  let catalogService: CatalogPortService;

  beforeEach(() => {
    catalogService = new CatalogPortService();

    // Giả lập nạp dữ liệu biến thể vào catalog repository/cache trong bộ nhớ
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

    // Biến thể có salePrice để test khuyến mãi
    catalogService.registerMockVariant(
      new ProductVariantEntity({
        variantId: 'variant-sale-102',
        productId: 'prod-002',
        variantName: 'Size',
        variantValue: 'XL',
        sku: 'AO-SALE-XL',
        price: '10.00',
        salePrice: '8.00',
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
      assert.equal(info.variantId, 'variant-101');
      assert.equal(info.price, '199000.00');
      assert.equal(info.stockQuantity, 10);
      assert.equal(info.status, 'ACTIVE');
      assert.equal(info.effectivePrice, '199000.00');
    });

    it('Đọc giá biến thể có khuyến mãi: trả về cả price, salePrice và effectivePrice', async () => {
      const info = await catalogService.getVariantPriceAndStock('variant-sale-102');
      assert.equal(info.price, '10.00');
      assert.equal(info.salePrice, '8.00');
      assert.equal(info.effectivePrice, '8.00');
    });

    it('Yêu cầu biến thể không tồn tại phải ném ValidationError (RESOURCE_NOT_FOUND)', async () => {
      await assert.rejects(
        async () => await catalogService.getVariantPriceAndStock('variant-non-existent'),
        (err: any) => err instanceof ValidationError
      );
    });
  });

  describe('Khóa biến thể và kiểm tra tồn kho [QD07]', () => {
    it('[QD07] Đặt số lượng 4 khi kho có 10 -> thành công, kho còn lại 6', async () => {
      const result = await catalogService.lockVariant('variant-101', 4);
      assert.equal(result.variantId, 'variant-101');
      assert.equal(result.priceSnapshot, '199000.00');
      assert.equal(result.remainingStock, 6);
    });

    it('[QD07] Đặt số lượng 15 khi kho chỉ có 10 -> ném InventoryInsufficientError (INVENTORY_INSUFFICIENT)', async () => {
      await assert.rejects(
        async () => await catalogService.lockVariant('variant-101', 15),
        (err: any) => err instanceof InventoryInsufficientError && err.code === 'INVENTORY_INSUFFICIENT'
      );
    });

    it('[QD07] Đặt số lượng âm (-2) phải bị từ chối với ValidationError và KHÔNG làm tăng tồn kho', async () => {
      await assert.rejects(
        async () => await catalogService.lockVariant('variant-sale-102', -2),
        (err: any) => err instanceof ValidationError
      );
      // Kiểm tra tồn kho vẫn là 5, không bị tăng thành 7
      const info = await catalogService.getVariantPriceAndStock('variant-sale-102');
      assert.equal(info.stockQuantity, 5);
    });

    it('[QD07] Đặt số lượng lẻ (0.5) hoặc bằng 0 phải bị từ chối với ValidationError', async () => {
      await assert.rejects(
        async () => await catalogService.lockVariant('variant-sale-102', 0.5),
        (err: any) => err instanceof ValidationError
      );
      await assert.rejects(
        async () => await catalogService.lockVariant('variant-sale-102', 0),
        (err: any) => err instanceof ValidationError
      );
      // Tồn kho không bị lẻ
      const info = await catalogService.getVariantPriceAndStock('variant-sale-102');
      assert.equal(info.stockQuantity, 5);
    });

    it('[Khuyến mãi Checkout] Khóa biến thể có salePrice trả priceSnapshot là giá khuyến mãi', async () => {
      const result = await catalogService.lockVariant('variant-sale-102', 1);
      assert.equal(result.priceSnapshot, '8.00');
      assert.equal(result.originalPriceSnapshot, '10.00');
      assert.equal(result.salePriceSnapshot, '8.00');
      assert.equal(result.remainingStock, 4);
    });
  });

  describe('Kiểm tra trạng thái Shop', () => {
    it('Shop ACTIVE -> trả về true', async () => {
      const isActive = await catalogService.checkShopActive('shop-001');
      assert.equal(isActive, true);
    });

    it('Shop LOCKED hoặc SUSPENDED -> trả về false', async () => {
      const isActive = await catalogService.checkShopActive('shop-locked');
      assert.equal(isActive, false);
    });
  });

});
