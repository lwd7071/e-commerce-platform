import type {
  UUID,
  Shop,
  ShopStatus,
  Category,
  CategoryStatus,
  Product,
  ProductStatus,
  ProductVariant,
  ProductImage,
  DecimalString,
} from './types.ts';

export interface ProductFilter {
  status?: ProductStatus;
  categoryId?: UUID;
}

export interface PublicProductFilter {
  categoryId?: UUID;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'created_at_desc';
  limit?: number;
  offset?: number;
}

export interface PublicProductSummary {
  productId: UUID;
  shopId: UUID;
  categoryId: UUID;
  productName: string;
  description: string | null;
  minPrice: DecimalString;
  maxPrice: DecimalString;
  totalStock: number;
  imageUrl: string | null;
  createdAt: string;
}

export interface IShopRepository {
  findById(shopId: UUID): Promise<Shop | null>;
  findByOwnerId(ownerId: UUID): Promise<Shop | null>;
  create(shop: Shop): Promise<Shop>;
  updateStatus(shopId: UUID, status: ShopStatus): Promise<Shop>;
}

export interface ICategoryRepository {
  findById(categoryId: UUID): Promise<Category | null>;
  findRoots(): Promise<Category[]>;
  findChildren(parentId: UUID): Promise<Category[]>;
  create(category: Category): Promise<Category>;
}

export interface IProductRepository {
  findById(productId: UUID): Promise<Product | null>;
  findByShopId(shopId: UUID, filter?: ProductFilter): Promise<Product[]>;
  queryPublic(filter: PublicProductFilter): Promise<{ items: PublicProductSummary[]; total: number }>;
  create(product: Product, variants: ProductVariant[], images?: ProductImage[]): Promise<Product>;
  updateStatus(productId: UUID, status: ProductStatus): Promise<Product>;
}

export interface IProductVariantRepository {
  findById(variantId: UUID, client?: any): Promise<ProductVariant | null>;
  findByProductId(productId: UUID): Promise<ProductVariant[]>;
  findBySku(shopId: UUID, sku: string): Promise<ProductVariant | null>;
  create(variant: ProductVariant, client?: any): Promise<ProductVariant>;
  lockForUpdate(variantId: UUID, client?: any): Promise<ProductVariant | null>;
  deductStock(variantId: UUID, quantity: number, client?: any): Promise<void>;
}
