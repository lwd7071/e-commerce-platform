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

  // Giả lập lưu trữ SKU của shop trong phạm vi domain
  private existingSkus: Set<string> = new Set();

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
    initialSkus?: string[];
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

    if (params.initialSkus) {
      for (const sku of params.initialSkus) {
        this.existingSkus.add(sku.toUpperCase());
      }
    }
  }

  /**
   * QD04: Chỉ Seller sở hữu Shop mới có quyền thao tác trên sản phẩm của Shop đó.
   */
  public assertOwnership(requestUserId: UUID): void {
    if (this.ownerId !== requestUserId) {
      throw new ForbiddenError(
        `Người dùng '${requestUserId}' không có quyền quản lý gian hàng '${this.shopId}' (QD04).`,
        { shopId: this.shopId, ownerId: this.ownerId, requestUserId }
      );
    }
  }

  /**
   * RB-LB11: Mã SKU là duy nhất trong phạm vi từng Shop.
   */
  public registerSku(sku: string): void {
    const normalizedSku = sku.trim().toUpperCase();
    if (this.existingSkus.has(normalizedSku)) {
      throw new SkuConflictError(
        `Mã SKU '${normalizedSku}' đã tồn tại trong gian hàng này (RB-LB11). Vui lòng chọn mã SKU khác.`,
        { shopId: this.shopId, sku: normalizedSku }
      );
    }
    this.existingSkus.add(normalizedSku);
  }
}
