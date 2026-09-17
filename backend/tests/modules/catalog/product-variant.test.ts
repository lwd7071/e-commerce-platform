import { describe, it, expect } from 'vitest';
import { ProductVariantEntity } from '../../../src/modules/catalog/domain/product-variant.ts';
import { ProductEntity } from '../../../src/modules/catalog/domain/product.ts';
import { ValidationError, StockInvalidError, ResourceDeleteNotAllowedError } from '../../../src/modules/catalog/domain/errors.ts';

describe('Catalog Domain: ProductVariant & Product Validation', () => {

  describe('ProductVariant Validation (QD05, QD06, Schema Freeze v1)', () => {
    const validParams = {
      variantId: '11111111-1111-4111-8111-111111111111',
      productId: '22222222-2222-4222-8222-222222222222',
      variantName: 'Màu sắc',
      variantValue: 'Đen - Size L',
      sku: 'AO-DEN-L',
      price: '250000.00',
      stockQuantity: 10,
      status: 'ACTIVE' as const,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
    };

    it('[QD05] Giá bán bắt buộc phải > 0: chấp nhận giá hợp lệ dạng decimal string', () => {
      const variant = new ProductVariantEntity(validParams);
      expect(variant.price).toBe('250000.00');
    });

    it('[QD05] Giá bán = 0 hoặc âm phải ném ValidationError (VALIDATION_FAILED)', () => {
      expect(() => new ProductVariantEntity({ ...validParams, price: '0.00' })).toThrow(ValidationError);
      expect(() => new ProductVariantEntity({ ...validParams, price: '-50000.00' })).toThrow(ValidationError);
    });

    it('[QD05] Giá có ký tự rác (như "10garbage" hoặc "abc") phải bị từ chối với ValidationError', () => {
      expect(() => new ProductVariantEntity({ ...validParams, price: '10garbage' })).toThrow(ValidationError);
      expect(() => new ProductVariantEntity({ ...validParams, price: 'not-a-number' })).toThrow(ValidationError);
    });

    it('[QD06] Tồn kho bắt buộc >= 0: chấp nhận tồn kho = 0 (hết hàng) và > 0', () => {
      const variantInStock = new ProductVariantEntity({ ...validParams, stockQuantity: 5 });
      expect(variantInStock.stockQuantity).toBe(5);

      const variantOutOfStock = new ProductVariantEntity({ ...validParams, stockQuantity: 0 });
      expect(variantOutOfStock.stockQuantity).toBe(0);
    });

    it('[QD06] Tồn kho âm hoặc số thập phân (0.5) phải ném StockInvalidError (STOCK_INVALID)', () => {
      expect(() => new ProductVariantEntity({ ...validParams, stockQuantity: -1 })).toThrow(StockInvalidError);
      expect(() => new ProductVariantEntity({ ...validParams, stockQuantity: 0.5 })).toThrow(StockInvalidError);
    });
  });

  describe('Product Validation & Immutability (QD16, Schema Freeze)', () => {
    const validProductParams = {
      productId: '22222222-2222-4222-8222-222222222222',
      shopId: '33333333-3333-4333-8333-333333333333',
      categoryId: '44444444-4444-4444-8444-444444444444',
      productName: 'Áo Thun Nam Cotton Cổ Tròn',
      description: 'Chất liệu cotton thoáng mát',
      status: 'ACTIVE' as const,
      createdAt: '2026-09-16T10:00:00.000Z',
      updatedAt: '2026-09-16T10:00:00.000Z',
    };

    it('Sản phẩm hợp lệ không lưu trường price hoặc stockQuantity (3NF & Single Source of Truth)', () => {
      const product = new ProductEntity(validProductParams);
      expect(product.productName).toBe('Áo Thun Nam Cotton Cổ Tròn');
      expect((product as any).price).toBeUndefined();
      expect((product as any).stockQuantity).toBeUndefined();
    });

    it('[QD16] Dữ liệu có lịch sử giao dịch: soft delete chỉ được đổi status sang INACTIVE hoặc HIDDEN', () => {
      const product = new ProductEntity(validProductParams);
      product.deactivate(true);
      expect(product.status).toBe('HIDDEN');

      expect(() => product.physicalDelete(true)).toThrow(ResourceDeleteNotAllowedError);
    });
  });

});
