import type { UUID, DecimalString, ProductStatus } from '../domain/types.ts';

export interface CreateProductInputDTO {
  shopId: UUID;
  categoryId: UUID;
  productName: string;
  description?: string | null;
  status?: ProductStatus;
  variants: Array<{
    variantName: string;
    variantValue: string | null;
    sku: string;
    price: DecimalString;
    stockQuantity: number;
  }>;
  images?: Array<{
    imageUrl: string;
    sortOrder: number;
  }>;
}

export interface UpdateStockInputDTO {
  variantId: UUID;
  newStockQuantity: number;
}
