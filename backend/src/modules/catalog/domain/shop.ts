import type { Shop, UUID, ShopStatus } from './types.ts';
import { ForbiddenError, SkuConflictError } from './errors.ts';

export class ShopEntity implements Shop {
  public readonly shopId: UUID;
  public readonly ownerId: UUID;
  public shopName: string;
  public description: string | null;
  public logoUrl: string | null;
  public pickupAddress: string;
  public contactPhone: string;
  public status: ShopStatus;
  public readonly createdAt: string;
  public updatedAt: string;

  private registeredSkus: Set<string> = new Set();

  constructor(params: {
    shopId: UUID;
    ownerId: UUID;
    shopName: string;
    description: string | null;
    logoUrl: string | null;
    pickupAddress: string;
    contactPhone: string;
    status: ShopStatus;
    createdAt: string;
    updatedAt: string;
  }) {
    this.shopId = params.shopId;
    this.ownerId = params.ownerId;
    this.shopName = params.shopName;
    this.description = params.description;
    this.logoUrl = params.logoUrl;
    this.pickupAddress = params.pickupAddress;
    this.contactPhone = params.contactPhone;
    this.status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * QD04: Seller chỉ được quản lý Shop/sản phẩm thuộc sở hữu của mình.
   */
  public assertOwner(requestUserId: UUID): void {
    if (this.ownerId !== requestUserId) {
      throw new ForbiddenError('Người dùng không có quyền thao tác trên Shop này (QD04).', {
        expectedOwnerId: this.ownerId,
        requestUserId,
      });
    }
  }

  /**
   * RB-LB11: SKU là duy nhất trong phạm vi từng Shop.
   */
  public registerSku(sku: string): void {
    const normalizedSku = sku.trim().toUpperCase();
    if (this.registeredSkus.has(normalizedSku)) {
      throw new SkuConflictError(`Mã SKU '${sku}' đã tồn tại trong phạm vi gian hàng này (RB-LB11).`, {
        sku,
        shopId: this.shopId,
      });
    }
    this.registeredSkus.add(normalizedSku);
  }
}
