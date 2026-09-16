import type { UUID, DecimalString, ProductStatus, VariantStatus } from '../domain/types';

export interface CreateProductRequestDTO {
  shopId: UUID;
  categoryId: UUID;
  productName: string;
  description?: string | null;
  images?: string[];
  variants: Array<{
    variantName: string;
    variantValue: string;
    sku: string;
    price: DecimalString;
    stockQuantity: number;
  }>;
}

export interface UpdateProductVariantStockDTO {
  variantId: UUID;
  stockQuantity: number;
}

export interface UpdateProductVariantPriceDTO {
  variantId: UUID;
  price: DecimalString;
  salePrice?: DecimalString | null;
}

export interface SellerProductResponseDTO {
  productId: UUID;
  shopId: UUID;
  productName: string;
  status: ProductStatus;
  variantCount: number;
  totalStock: number;
  updatedAt: string;
}
