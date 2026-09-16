import type { Product, UUID, ProductStatus } from './types';
import { ResourceDeleteNotAllowedError } from './errors';

export class ProductEntity implements Product {
  public readonly productId: UUID;
  public readonly shopId: UUID;
  public categoryId: UUID;
  public productName: string;
  public description: string | null;
  public status: ProductStatus;
  public readonly createdAt: string;
  public updatedAt: string;

  constructor(params: {
    productId: UUID;
    shopId: UUID;
    categoryId: UUID;
    productName: string;
    description: string | null;
    status: ProductStatus;
    createdAt: string;
    updatedAt: string;
  }) {
    this.productId = params.productId;
    this.shopId = params.shopId;
    this.categoryId = params.categoryId;
    this.productName = params.productName;
    this.description = params.description;
    this.status = params.status;
    this.createdAt = params.createdAt;
    this.updatedAt = params.updatedAt;
  }

  /**
   * QD16: Dữ liệu có lịch sử giao dịch không được xóa vật lý,
   * chỉ được chuyển trạng thái INACTIVE hoặc HIDDEN.
   */
  public deactivate(hasTransactions: boolean): void {
    if (hasTransactions) {
      this.status = 'HIDDEN';
    } else {
      this.status = 'INACTIVE';
    }
  }

  public physicalDelete(hasTransactions: boolean): void {
    if (hasTransactions) {
      throw new ResourceDeleteNotAllowedError(
        'Không thể xóa vật lý sản phẩm đã phát sinh giao dịch lịch sử (QD16). Hãy dùng cơ chế ẩn (HIDDEN).'
      );
    }
  }
}
