import type { ProductVariant, UUID, VariantStatus, DecimalString } from './types.ts';
import { ValidationError, StockInvalidError } from './errors.ts';

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
    // Validate Price > 0 (QD05)
    const numericPrice = parseFloat(params.price);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      throw new ValidationError('Giá bán của biến thể sản phẩm bắt buộc phải lớn hơn 0 (QD05).', {
        price: params.price,
      });
    }

    // Validate StockQuantity >= 0 (QD06)
    if (params.stockQuantity < 0 || !Number.isInteger(params.stockQuantity)) {
      throw new StockInvalidError('Số lượng tồn kho phải là số nguyên không âm (QD06).', {
        stockQuantity: params.stockQuantity,
      });
    }

    // Validate SalePrice <= Price (RB-LTT09)
    if (params.salePrice != null) {
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
}
