import type {
  UUID,
  Shop,
  ShopStatus,
  Category,
  Product,
  ProductStatus,
  ProductVariant,
  ProductImage,
} from '../domain/types.ts';
import type {
  IShopRepository,
  ICategoryRepository,
  IProductRepository,
  IProductVariantRepository,
  ProductFilter,
  PublicProductFilter,
  PublicProductSummary,
} from '../domain/repositories.ts';

export class InMemoryShopRepository implements IShopRepository {
  private shops = new Map<UUID, Shop>();

  async findById(shopId: UUID): Promise<Shop | null> {
    return this.shops.get(shopId) ?? null;
  }

  async findByOwnerId(ownerId: UUID): Promise<Shop | null> {
    for (const shop of this.shops.values()) {
      if (shop.ownerId === ownerId) return shop;
    }
    return null;
  }

  async create(shop: Shop): Promise<Shop> {
    this.shops.set(shop.shopId, { ...shop });
    return { ...shop };
  }

  async updateStatus(shopId: UUID, status: ShopStatus): Promise<Shop> {
    const shop = this.shops.get(shopId);
    if (!shop) throw new Error(`Shop ${shopId} not found`);
    shop.status = status;
    shop.updatedAt = new Date().toISOString();
    return { ...shop };
  }
}

export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories = new Map<UUID, Category>();

  async findById(categoryId: UUID): Promise<Category | null> {
    return this.categories.get(categoryId) ?? null;
  }

  async findRoots(): Promise<Category[]> {
    return Array.from(this.categories.values()).filter((c) => c.parentCategoryId === null);
  }

  async findChildren(parentId: UUID): Promise<Category[]> {
    return Array.from(this.categories.values()).filter((c) => c.parentCategoryId === parentId);
  }

  async create(category: Category): Promise<Category> {
    this.categories.set(category.categoryId, { ...category });
    return { ...category };
  }
}

export class InMemoryProductVariantRepository implements IProductVariantRepository {
  private variants = new Map<UUID, ProductVariant>();

  async findById(variantId: UUID): Promise<ProductVariant | null> {
    return this.variants.get(variantId) ?? null;
  }

  async findByProductId(productId: UUID): Promise<ProductVariant[]> {
    return Array.from(this.variants.values()).filter((v) => v.productId === productId);
  }

  async findBySku(shopId: UUID, sku: string): Promise<ProductVariant | null> {
    for (const v of this.variants.values()) {
      if (v.sku === sku) return v;
    }
    return null;
  }

  async create(variant: ProductVariant): Promise<ProductVariant> {
    this.variants.set(variant.variantId, { ...variant });
    return { ...variant };
  }

  async lockForUpdate(variantId: UUID): Promise<ProductVariant | null> {
    return this.findById(variantId);
  }

  async deductStock(variantId: UUID, quantity: number): Promise<void> {
    const v = this.variants.get(variantId);
    if (!v) throw new Error(`Variant ${variantId} not found`);
    v.stockQuantity -= quantity;
  }

  getAll(): ProductVariant[] {
    return Array.from(this.variants.values());
  }
}

export class InMemoryProductRepository implements IProductRepository {
  private products = new Map<UUID, Product>();
  private images = new Map<UUID, ProductImage[]>();
  private shopRepo: IShopRepository;
  private categoryRepo: ICategoryRepository;
  private variantRepo: IProductVariantRepository;

  constructor(
    shopRepo: IShopRepository,
    categoryRepo: ICategoryRepository,
    variantRepo: IProductVariantRepository
  ) {
    this.shopRepo = shopRepo;
    this.categoryRepo = categoryRepo;
    this.variantRepo = variantRepo;
  }

  async findById(productId: UUID): Promise<Product | null> {
    return this.products.get(productId) ?? null;
  }

  async findByShopId(shopId: UUID, filter?: ProductFilter): Promise<Product[]> {
    return Array.from(this.products.values()).filter((p) => {
      if (p.shopId !== shopId) return false;
      if (filter?.status && p.status !== filter.status) return false;
      if (filter?.categoryId && p.categoryId !== filter.categoryId) return false;
      return true;
    });
  }

  async create(
    product: Product,
    variants: ProductVariant[],
    images: ProductImage[] = [],
    _client?: unknown,
  ): Promise<Product> {
    this.products.set(product.productId, { ...product });
    for (const v of variants) {
      await this.variantRepo.create(v);
    }
    this.images.set(product.productId, [...images]);
    return { ...product };
  }

  async updateStatus(productId: UUID, status: ProductStatus): Promise<Product> {
    const p = this.products.get(productId);
    if (!p) throw new Error(`Product ${productId} not found`);
    p.status = status;
    p.updatedAt = new Date().toISOString();
    return { ...p };
  }

  async queryPublic(filter: PublicProductFilter): Promise<{ items: PublicProductSummary[]; total: number; nextCursor?: string | null }> {
    const allProducts = Array.from(this.products.values());
    const matchedSummaries: PublicProductSummary[] = [];

    for (const p of allProducts) {
      // Visibility Rule 1: Product must be ACTIVE
      if (p.status !== 'ACTIVE') continue;

      // Visibility Rule 2: Shop must be ACTIVE
      const shop = await this.shopRepo.findById(p.shopId);
      if (!shop || shop.status !== 'ACTIVE') continue;

      // Visibility Rule 3: Category must be ACTIVE
      const category = await this.categoryRepo.findById(p.categoryId);
      if (!category || category.status !== 'ACTIVE') continue;

      // Filter: categoryId
      if (filter.categoryId && p.categoryId !== filter.categoryId) continue;

      // Filter: search keyword
      if (filter.search && !p.productName.toLowerCase().includes(filter.search.toLowerCase())) {
        continue;
      }

      // Variants
      const productVariants = await this.variantRepo.findByProductId(p.productId);
      const activeVariants = productVariants.filter((v) => v.status === 'ACTIVE');
      if (activeVariants.length === 0) continue;

      const prices = activeVariants.map((v) => parseFloat(v.price));
      const minPriceNum = Math.min(...prices);
      const maxPriceNum = Math.max(...prices);

      // Filter: price range
      if (filter.minPrice !== undefined && maxPriceNum < filter.minPrice) continue;
      if (filter.maxPrice !== undefined && minPriceNum > filter.maxPrice) continue;

      const totalStock = activeVariants.reduce((sum, v) => sum + v.stockQuantity, 0);
      const productImages = this.images.get(p.productId) ?? [];
      const primaryImage = productImages.sort((a, b) => a.sortOrder - b.sortOrder)[0]?.imageUrl ?? null;

      matchedSummaries.push({
        productId: p.productId,
        shopId: p.shopId,
        categoryId: p.categoryId,
        productName: p.productName,
        description: p.description,
        minPrice: minPriceNum.toFixed(2),
        maxPrice: maxPriceNum.toFixed(2),
        totalStock,
        imageUrl: primaryImage,
        createdAt: p.createdAt,
      });
    }

    // Sort
    if (filter.sortBy === 'price_asc') {
      matchedSummaries.sort((a, b) => parseFloat(a.minPrice) - parseFloat(b.minPrice));
    } else if (filter.sortBy === 'price_desc') {
      matchedSummaries.sort((a, b) => parseFloat(b.maxPrice) - parseFloat(a.maxPrice));
    } else if (filter.sortBy === 'created_at_desc') {
      matchedSummaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const total = matchedSummaries.length;
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? matchedSummaries.length;
    const paginated = matchedSummaries.slice(offset, offset + limit);

    return { items: paginated, total };
  }
}
