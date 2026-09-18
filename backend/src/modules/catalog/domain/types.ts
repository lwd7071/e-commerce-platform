export type UUID = string;

export type ShopStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
export type CategoryStatus = 'ACTIVE' | 'INACTIVE';
export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'HIDDEN';
export type VariantStatus = 'ACTIVE' | 'INACTIVE';

export type DecimalString = string;

export interface Shop {
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
}

export interface Category {
  categoryId: UUID;
  parentCategoryId: UUID | null;
  categoryName: string;
  description: string | null;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  productId: UUID;
  shopId: UUID;
  categoryId: UUID;
  productName: string;
  description: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  imageId: UUID;
  productId: UUID;
  imageUrl: string;
  sortOrder: number;
}

export interface ProductVariant {
  variantId: UUID;
  productId: UUID;
  variantName: string;
  variantValue: string | null;
  sku: string;
  price: DecimalString;
  stockQuantity: number;
  status: VariantStatus;
  createdAt: string;
  updatedAt: string;
}
