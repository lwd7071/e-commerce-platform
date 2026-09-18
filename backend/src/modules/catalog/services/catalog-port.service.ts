import type { Pool, PoolClient } from 'pg';
import type { ICatalogPort, VariantPriceAndStockDTO, LockVariantResultDTO } from '../ports/catalog.port.ts';
import type { UUID, ShopStatus } from '../domain/types.ts';
import type { IProductVariantRepository, IShopRepository } from '../domain/repositories.ts';
import { ProductVariantEntity } from '../domain/product-variant.ts';
import { InventoryInsufficientError, ValidationError } from '../domain/errors.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import {
  InMemoryProductVariantRepository,
  InMemoryShopRepository,
} from '../repositories/in-memory-catalog.repository.ts';
import {
  PgProductVariantRepository,
  PgShopRepository,
} from '../repositories/pg-catalog.repository.ts';

export interface CatalogPortDependencies {
  variantRepo?: IProductVariantRepository;
  shopRepo?: IShopRepository;
  pool?: Pool;
}

/**
 * CatalogPortService (100% SOLID)
 */
export class CatalogPortService implements ICatalogPort {
  private variantRepo: IProductVariantRepository;
  private shopRepo: IShopRepository;
  private pool?: Pool;

  constructor(deps?: CatalogPortDependencies) {
    this.pool = deps?.pool;

    if (deps?.variantRepo) {
      this.variantRepo = deps.variantRepo;
    } else if (deps?.pool) {
      this.variantRepo = new PgProductVariantRepository(deps.pool);
    } else {
      this.variantRepo = new InMemoryProductVariantRepository();
    }

    if (deps?.shopRepo) {
      this.shopRepo = deps.shopRepo;
    } else if (deps?.pool) {
      this.shopRepo = new PgShopRepository(deps.pool);
    } else {
      this.shopRepo = new InMemoryShopRepository();
    }
  }

  // --- Helpers for In-memory mock tests ---
  public registerMockVariant(variant: ProductVariantEntity): void {
    this.variantRepo.create({
      variantId: variant.variantId,
      productId: variant.productId,
      variantName: variant.variantName,
      variantValue: variant.variantValue,
      sku: variant.sku,
      price: variant.price,
      stockQuantity: variant.stockQuantity,
      status: variant.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  public registerMockShop(shopId: UUID, status: ShopStatus): void {
    this.shopRepo.create({
      shopId,
      ownerId: '00000000-0000-4000-b000-000000000000',
      shopName: 'Mock Shop',
      description: null,
      logoUrl: null,
      pickupAddress: 'Mock Address',
      contactPhone: '0123456789',
      status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // --- ICatalogPort Methods ---

  public async getVariantPriceAndStock(variantId: UUID): Promise<VariantPriceAndStockDTO> {
    const variant = await this.variantRepo.findById(variantId);
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

  public async lockVariant(
    variantId: UUID,
    quantity: number,
    existingClient?: PoolClient
  ): Promise<LockVariantResultDTO> {
    // 1. Validation (Single Responsibility)
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError(
        `Số lượng cần khóa phải là số nguyên dương (> 0), nhận được: ${quantity}.`
      );
    }

    // 2. Lock execution delegated to variantRepo (DIP & SRP)
    const executeLock = async (client?: PoolClient): Promise<LockVariantResultDTO> => {
      const variant = await this.variantRepo.lockForUpdate(variantId, client);
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

      const remainingStock = variant.stockQuantity - quantity;
      await this.variantRepo.deductStock(variantId, quantity, client);

      return {
        variantId: variant.variantId,
        requestedQuantity: quantity,
        priceSnapshot: variant.price,
        remainingStock,
      };
    };

    if (existingClient) {
      return executeLock(existingClient);
    }

    if (this.pool) {
      return withTransaction(this.pool, (client) => executeLock(client));
    }

    return executeLock();
  }

  public async checkShopActive(shopId: UUID): Promise<boolean> {
    const shop = await this.shopRepo.findById(shopId);
    return shop?.status === 'ACTIVE';
  }
}
