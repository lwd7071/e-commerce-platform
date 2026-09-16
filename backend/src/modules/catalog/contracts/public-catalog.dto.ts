import type { UUID, DecimalString, ProductStatus, VariantStatus } from '../domain/types';

export interface PublicCategoryItemDTO {
  categoryId: UUID;
  parentCategoryId: UUID | null;
  categoryName: string;
  description: string | null;
}

export interface PublicVariantSummaryDTO {
  variantId: UUID;
  variantName: string;
  variantValue: string;
  price: DecimalString;
  inStock: boolean;
}

export interface PublicProductDetailDTO {
  productId: UUID;
  shopId: UUID;
  shopName: string;
  categoryId: UUID;
  categoryName: string;
  productName: string;
  description: string | null;
  images: string[];
  variants: PublicVariantSummaryDTO[];
  status: ProductStatus;
}

export interface PublicProductListItemDTO {
  productId: UUID;
  productName: string;
  thumbnailUrl: string | null;
  minPrice: DecimalString;
  maxPrice: DecimalString;
  shopName: string;
}
