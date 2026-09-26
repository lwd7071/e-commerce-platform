import type {
  UUID,
  Shop,
  ShopStatus,
  Category,
  Product,
  ProductStatus,
  ProductVariant,
  ProductImage,
  DecimalString,
} from './types.ts';
import type { DatabaseExecutor } from '../../../../db/types.ts';

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
  cursor?: string;
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
  queryPublic(filter: PublicProductFilter): Promise<{ items: PublicProductSummary[]; total: number; nextCursor?: string | null }>;
  create(product: Product, variants: ProductVariant[], images?: ProductImage[]): Promise<Product>;
  updateStatus(productId: UUID, status: ProductStatus): Promise<Product>;
}

export interface IProductVariantRepository {
  findById(variantId: UUID, client?: DatabaseExecutor): Promise<ProductVariant | null>;
  findByProductId(productId: UUID): Promise<ProductVariant[]>;
  findBySku(shopId: UUID, sku: string): Promise<ProductVariant | null>;
  create(variant: ProductVariant, client?: DatabaseExecutor): Promise<ProductVariant>;
  lockForUpdate(variantId: UUID, client?: DatabaseExecutor): Promise<ProductVariant | null>;
  deductStock(variantId: UUID, quantity: number, client?: DatabaseExecutor): Promise<void>;
}
