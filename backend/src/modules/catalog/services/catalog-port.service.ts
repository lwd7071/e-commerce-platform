import type { Pool, PoolClient } from 'pg';
import type { ICatalogPort, VariantPriceAndStockDTO, LockVariantResultDTO } from '../ports/catalog.port.ts';
import type { UUID, ShopStatus } from '../domain/types.ts';
import { ProductVariantEntity } from '../domain/product-variant.ts';
import { InventoryInsufficientError, ValidationError } from '../domain/errors.ts';
import { withTransaction } from '../../../../db/transaction.ts';

export interface CatalogPortServiceOptions {
  pool?: Pool;
}

/**
 * CatalogPortService
 * Hỗ trợ 2 chế độ:
 * 1. In-memory Mock/Stub (khi không truyền pool) phục vụ unit tests chạy nhanh độc lập.
 * 2. Real PostgreSQL Mode (khi truyền pool) thực thi row-level locking (SELECT ... FOR UPDATE)
 *    và giao dịch ACID qua withTransaction của Người 2.
 */
export class CatalogPortService implements ICatalogPort {
  private pool?: Pool;
  private variantStorage: Map<UUID, ProductVariantEntity> = new Map();
  private shopStorage: Map<UUID, ShopStatus> = new Map();

  constructor(options?: CatalogPortServiceOptions) {
    this.pool = options?.pool;
  }

  // --- Helpers for In-memory testing ---
  public registerMockVariant(variant: ProductVariantEntity): void {
    this.variantStorage.set(variant.variantId, variant);
  }

  public registerMockShop(shopId: UUID, status: ShopStatus): void {
    this.shopStorage.set(shopId, status);
  }

  // --- Contract Methods ---

  public async getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO> {
    if (this.pool) {
      const res = await this.pool.query(
        'SELECT variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status FROM product_variants WHERE variant_id = $1',
        [variantId]
      );
      const row = res.rows[0];
      if (!row) {
        throw new ValidationError(`Biến thể sản phẩm '${variantId}' không tồn tại trong hệ thống.`);
      }
      return {
        variantId: row.variant_id,
        productId: row.product_id,
        variantName: row.variant_name,
        variantValue: row.variant_value,
        price: String(row.price),
        stockQuantity: Number(row.stock_quantity),
        status: row.status,
      };
    }

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
   * Khi kết nối DB thật: Thực thi SELECT ... FOR UPDATE trên PostgreSQL để chống race condition.
   */
  public async lockVariant(
    variantId: UUID,
    quantity: number,
    existingClient?: PoolClient
  ): Promise<LockVariantResultDTO> {
    // Xác thực số lượng: Bắt buộc là số nguyên dương (> 0) (QD06, QD07)
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(
        `Số lượng cần khóa phải là số nguyên dương (> 0), nhận được: ${quantity}.`
      );
    }

    // Nếu chạy với DB thật
    if (this.pool || existingClient) {
      const executeLock = async (client: PoolClient): Promise<LockVariantResultDTO> => {
        const res = await client.query(
          `SELECT variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status 
           FROM product_variants 
           WHERE variant_id = $1 
           FOR UPDATE`,
          [variantId]
        );
        const row = res.rows[0];
        if (!row) {
          throw new ValidationError(`Biến thể sản phẩm '${variantId}' không tồn tại.`);
        }

        if (row.status !== 'ACTIVE') {
          throw new ValidationError(`Biến thể sản phẩm '${variantId}' hiện không ở trạng thái mở bán.`);
        }

        const stock = Number(row.stock_quantity);
        if (stock < quantity) {
          throw new InventoryInsufficientError(
            `Số lượng tồn kho không đủ (còn ${stock}, yêu cầu ${quantity}) (QD07).`,
            {
              variantId,
              availableStock: stock,
              requestedQuantity: quantity,
            }
          );
        }

        const remainingStock = stock - quantity;
        await client.query(
          'UPDATE product_variants SET stock_quantity = $1, updated_at = now() WHERE variant_id = $2',
          [remainingStock, variantId]
        );

        return {
          variantId: row.variant_id,
          requestedQuantity: quantity,
          priceSnapshot: String(row.price),
          remainingStock,
        };
      };

      if (existingClient) {
        return executeLock(existingClient);
      }

      return withTransaction(this.pool!, (client) => executeLock(client));
    }

    // In-memory fallback
    const variant = this.variantStorage.get(variantId);
    if (!variant) {
      throw new ValidationError(`Biến thể sản phẩm '${variantId}' không tồn tại.`);
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
    if (this.pool) {
      const res = await this.pool.query('SELECT status FROM shops WHERE shop_id = $1', [shopId]);
      return res.rows[0]?.status === 'ACTIVE';
    }

    const status = this.shopStorage.get(shopId);
    return status === 'ACTIVE';
  }
}
