import type { ProductVariant, UUID, VariantStatus, DecimalString } from './types';
import { ValidationError, StockInvalidError } from './errors';

export class ProductVariantEntity implements ProductVariant {
  public readonly variantId: UUID;
  public readonly productId: UUID;
  public variantName: string;
  public variantValue: string;
  public sku: string;
  public price: DecimalString;
  public salePrice?: DecimalString | null;
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
    salePrice?: DecimalString | null;
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

    // Validate SalePrice <= Price and strict decimal format (RB-LTT09)
    if (params.salePrice != null) {
      if (typeof params.salePrice !== 'string' || !/^\d+(\.\d+)?$/.test(params.salePrice)) {
        throw new ValidationError('Giá khuyến mãi không đúng định dạng số thập phân hợp lệ (RB-LTT09).', {
          salePrice: params.salePrice,
        });
      }
      const numericSalePrice = parseFloat(params.salePrice);
      if (isNaN(numericSalePrice) || numericSalePrice <= 0 || numericSalePrice > numericPrice) {
        throw new ValidationError('Giá khuyến mãi phải lớn hơn 0 và không được vượt quá giá gốc (RB-LTT09).', {
          price: params.price,
          salePrice: params.salePrice,
        });
      }
    }

    this.variantId = params.variantId;
    this.productId = params.productId;
    this.variantName = params.variantName;
    this.variantValue = params.variantValue;
    this.sku = params.sku;
    this.price = params.price;
    this.salePrice = params.salePrice ?? null;
    this.stockQuantity = params.stockQuantity;
    this.status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  public get effectivePrice(): DecimalString {
    return (this.salePrice != null && this.salePrice.trim().length > 0)
      ? this.salePrice
      : this.price;
  }
}
