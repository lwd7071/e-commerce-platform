import type { Pool } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { PgProductRepository, PgProductVariantRepository } from '../repositories/pg-catalog.repository.ts';
import type { Product, ProductImage, ProductVariant } from '../domain/types.ts';

const decimal = /^\d+(\.\d{1,2})?$/;

export class PgCatalogHttpService {
  private readonly products: PgProductRepository;
  private readonly variants: PgProductVariantRepository;

  constructor(private readonly pool: Pool) {
    this.products = new PgProductRepository(pool);
    this.variants = new PgProductVariantRepository(pool);
  }

  async listProducts(input: Record<string, unknown>) {
    const limit = input.limit === undefined ? 20 : Number(input.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be an integer from 1 to 100');
    const parseMoney = (value: unknown): number | undefined => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || !decimal.test(value)) throw new Error('price filter must be a decimal string');
      return Number(value);
    };
    const result = await this.products.queryPublic({
      categoryId: input.category_id as string | undefined,
      search: input.search as string | undefined,
      minPrice: parseMoney(input.min_price), maxPrice: parseMoney(input.max_price),
      sortBy: input.sort === 'price_asc' || input.sort === 'price_desc' || input.sort === 'created_at_desc' ? input.sort : undefined,
      limit, cursor: input.cursor as string | undefined,
    });
    return {
      items: result.items.map(item => ({ product_id: item.productId, product_name: item.productName, shop_id: item.shopId, category_id: item.categoryId, min_price: item.minPrice, max_price: item.maxPrice, total_stock: item.totalStock, image_url: item.imageUrl, created_at: item.createdAt })),
      next_cursor: result.nextCursor ?? null, has_more: result.nextCursor != null, limit,
    };
  }

  async getProduct(productId: string): Promise<unknown> {
    const product = await this.products.findById(productId);
    if (!product) throw new Error('Product not found');
    const variants = await this.variants.findByProductId(productId);
    return { product_id: product.productId, shop_id: product.shopId, category_id: product.categoryId, product_name: product.productName, description: product.description, status: product.status, variants: variants.map(v => ({ variant_id: v.variantId, variant_name: v.variantName, variant_value: v.variantValue, sku: v.sku, price: v.price, stock_quantity: v.stockQuantity, status: v.status })) };
  }

  async createProduct(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    if (!context.shop_id) throw new Error('Seller shop is required');
    const rawVariants = Array.isArray(input.variants) ? input.variants : [];
    if (!rawVariants.length) throw new Error('At least one variant is required');
    const now = new Date().toISOString(); const productId = crypto.randomUUID();
    const product: Product = { productId, shopId: context.shop_id, categoryId: String(input.category_id), productName: String(input.product_name), description: input.description == null ? null : String(input.description), status: 'ACTIVE', createdAt: now, updatedAt: now };
    const variants: ProductVariant[] = rawVariants.map((raw: any) => ({ variantId: crypto.randomUUID(), productId, variantName: String(raw.variant_name), variantValue: raw.variant_value == null ? null : String(raw.variant_value), sku: String(raw.sku), price: String(raw.price), stockQuantity: Number(raw.stock_quantity ?? 0), status: 'ACTIVE', createdAt: now, updatedAt: now }));
    const images: ProductImage[] = (Array.isArray(input.images) ? input.images : []).map((url, index) => ({ imageId: crypto.randomUUID(), productId, imageUrl: String(url), sortOrder: index }));
    await this.products.create(product, variants, images);
    return this.getProduct(productId);
  }

  async updateVariantStock(context: RequestContext, variantId: string, input: Record<string, unknown>): Promise<unknown> {
    if (!context.shop_id || !Number.isInteger(input.quantity) || Number(input.quantity) < 0) throw new Error('Invalid stock quantity');
    const result = await this.pool.query(
      `UPDATE product_variants v SET stock_quantity=$1,updated_at=now()
         FROM products p WHERE v.product_id=p.product_id AND v.variant_id=$2 AND p.shop_id=$3 RETURNING v.*`,
      [Number(input.quantity), variantId, context.shop_id],
    );
    if (!result.rows[0]) throw new Error('Variant not found for seller shop');
    return { variant_id: result.rows[0].variant_id, stock_quantity: Number(result.rows[0].stock_quantity) };
  }
}
