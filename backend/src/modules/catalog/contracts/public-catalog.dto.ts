import type { UUID, DecimalString, ProductStatus, VariantStatus } from '../domain/types.ts';

export interface PublicProductQueryDTO {
  categoryId?: UUID;
  keyword?: string;
  minPrice?: DecimalString;
  maxPrice?: DecimalString;
  page?: number;
  limit?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'created_at_desc';
}

export interface PublicProductListItemDTO {
  productId: UUID;
  productName: string;
  shopId: UUID;
  categoryId: UUID;
  minPrice: DecimalString;
  maxPrice: DecimalString;
  primaryImageUrl: string | null;
  status: ProductStatus;
}
