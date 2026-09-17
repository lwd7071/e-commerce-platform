import type { ProductVariant, UUID, VariantStatus, DecimalString } from './types.ts';
import { ValidationError, StockInvalidError } from './errors.ts';

export class ProductVariantEntity implements ProductVariant {
  public readonly variantId: UUID;
  public readonly productId: UUID;
  public variantName: string;
  public variantValue: string;
  public sku: string;
  public price: DecimalString;
  public stockQuantity: number;
  public status: VariantStatus;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(params: {
    variantId: UUID;
    productId: UUID;
    variantName: string;
    variantValue: string;
    sku: string;
    price: DecimalString;
    stockQuantity: number;
    status: VariantStatus;
    createdAt: string;
    updatedAt: string;
  }) {
    // Validate Price > 0 and strict decimal format (QD05)
    if (typeof params.price !== 'string' || !/^\d+(\.\d+)?$/.test(params.price)) {
      throw new ValidationError('Giá bán không đúng định dạng số thập phân hợp lệ (QD05).', {
        price: params.price,
      });
    }
    const numericPrice = parseFloat(params.price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new ValidationError('Giá bán của biến thể sản phẩm bắt buộc phải lớn hơn 0 (QD05).', {
        price: params.price,
      });
    }

    // Validate StockQuantity >= 0 (QD06)
    if (typeof params.stockQuantity !== 'number' || !Number.isInteger(params.stockQuantity) || params.stockQuantity < 0) {
      throw new StockInvalidError('Số lượng tồn kho phải là số nguyên không âm (QD06).', {
        stockQuantity: params.stockQuantity,
      });
    }

    this.variantId = params.variantId;
    this.productId = params.productId;
    this.variantName = params.variantName;
    this.variantValue = params.variantValue;
    this.sku = params.sku;
    this.price = params.price;
    this.stockQuantity = params.stockQuantity;
    this.status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }
}
