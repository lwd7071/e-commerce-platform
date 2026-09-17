import type { ICatalogPort, VariantPriceAndStockDTO, LockVariantResultDTO } from '../ports/catalog.port.ts';
import type { UUID, ShopStatus } from '../domain/types.ts';
import { ProductVariantEntity } from '../domain/product-variant.ts';
import { InventoryInsufficientError, ValidationError } from '../domain/errors.ts';

/**
 * CatalogPortService (T1 In-memory Mock/Stub)
 * Lưu ý: Trong mốc T1, service này hoạt động ở chế độ in-memory stub nhằm khóa contract
 * và phục vụ test độc lập. Việc tích hợp DB transaction/row-level lock với PostgreSQL
 * sẽ được triển khai ở mốc T2 khi Người 2 bàn giao database connection.
 */
export class CatalogPortService implements ICatalogPort {
  private variantStorage: Map<UUID, ProductVariantEntity> = new Map();
  private shopStorage: Map<UUID, ShopStatus> = new Map();

  public registerMockVariant(variant: ProductVariantEntity): void {
    this.variantStorage.set(variant.variantId, variant);
  }

  public registerMockShop(shopId: UUID, status: ShopStatus): void {
    this.shopStorage.set(shopId, status);
  }

  public async getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO> {
    const variant = this.variantStorage.get(variantId);
    if (!variant) {
      throw new ValidationError(`Biến thể sản phẩm '${variantId}' không tồn tại trong hệ thống.`);
    }

    return {
      variantId: variant.variantId,
      productId: variant.productId,
      variantName: variant.variantName,
      variantValue: variant.variantValue,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      status: variant.status,
    };
  }

  /**
   * QD07: Khóa và kiểm tra tồn kho phục vụ Transaction Checkout của Người 5.
   */
  public async lockVariant(variantId: UUID, quantity: number): Promise<LockVariantResultDTO> {
    const variant = this.variantStorage.get(variantId);
    if (!variant) {
      throw new ValidationError(`Biến thể sản phẩm '${variantId}' không tồn tại.`);
    }

    // Xác thực số lượng: Bắt buộc là số nguyên dương (> 0) (QD06, QD07)
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(
        `Số lượng cần khóa phải là số nguyên dương (> 0), nhận được: ${quantity}.`
      );
    }

    if (variant.status !== 'ACTIVE') {
      throw new ValidationError(`Biến thể sản phẩm '${variantId}' hiện không ở trạng thái mở bán.`);
    }

    if (variant.stockQuantity < quantity) {
      throw new InventoryInsufficientError(
        `Số lượng tồn kho không đủ (còn ${variant.stockQuantity}, yêu cầu ${quantity}) (QD07).`,
        {
          variantId,
          availableStock: variant.stockQuantity,
          requestedQuantity: quantity,
        }
      );
    }

    // Cập nhật trừ tồn kho trong phiên bộ nhớ (T1 stub)
    variant.stockQuantity -= quantity;

    return {
      variantId: variant.variantId,
      requestedQuantity: quantity,
      priceSnapshot: variant.price,
      remainingStock: variant.stockQuantity,
    };
  }

  public async checkShopActive(shopId: UUID): Promise<boolean> {
    const status = this.shopStorage.get(shopId);
    return status === 'ACTIVE';
  }
}
