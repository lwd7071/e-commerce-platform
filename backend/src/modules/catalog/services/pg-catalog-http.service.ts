import type { Pool } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { PgProductRepository, PgProductVariantRepository } from '../repositories/pg-catalog.repository.ts';
import type { Product, ProductImage, ProductVariant } from '../domain/types.ts';
import {
  ValidationError,
  ForbiddenError,
  ResourceNotFoundError,
  SkuConflictError,
  StockInvalidError,
} from '../domain/errors.ts';

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
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('limit must be an integer from 1 to 100');
    }
    const parseMoney = (value: unknown): number | undefined => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string' || !decimal.test(value)) {
        throw new ValidationError('price filter must be a decimal string');
      }
      return Number(value);
    };
    const result = await this.products.queryPublic({
      categoryId: input.category_id as string | undefined,
      search: input.search as string | undefined,
      minPrice: parseMoney(input.min_price),
      maxPrice: parseMoney(input.max_price),
      sortBy:
        input.sort === 'price_asc' || input.sort === 'price_desc' || input.sort === 'created_at_desc'
          ? input.sort
          : undefined,
      limit,
      cursor: input.cursor as string | undefined,
    });
    return {
      items: result.items.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        shop_id: item.shopId,
        category_id: item.categoryId,
        min_price: item.minPrice,
        max_price: item.maxPrice,
        total_stock: item.totalStock,
        image_url: item.imageUrl,
        created_at: item.createdAt,
      })),
      next_cursor: result.nextCursor ?? null,
      has_more: result.nextCursor != null,
      limit,
    };
  }

  async getProduct(productId: string): Promise<unknown> {
    const res = await this.pool.query(
      `SELECT 
         p.product_id, p.shop_id, p.category_id, p.product_name, p.description, p.status,
         s.status AS shop_status,
         c.status AS category_status
       FROM products p
       JOIN shops s ON p.shop_id = s.shop_id
       JOIN categories c ON p.category_id = c.category_id
       WHERE p.product_id = $1`,
      [productId],
    );

    if (res.rows.length === 0) {
      throw new ResourceNotFoundError(`Product ${productId} not found`);
    }

    const row = res.rows[0];
    if (row.status !== 'ACTIVE' || row.shop_status !== 'ACTIVE' || row.category_status !== 'ACTIVE') {
      throw new ResourceNotFoundError(`Product ${productId} not found`);
    }

    const variants = await this.variants.findByProductId(productId);
    const activeVariants = variants.filter((v) => v.status === 'ACTIVE');
    if (activeVariants.length === 0) {
      throw new ResourceNotFoundError(`Product ${productId} not found`);
    }

    return {
      product_id: row.product_id,
      shop_id: row.shop_id,
      category_id: row.category_id,
      product_name: row.product_name,
      description: row.description,
      status: row.status,
      variants: activeVariants.map((v) => ({
        variant_id: v.variantId,
        variant_name: v.variantName,
        variant_value: v.variantValue,
        sku: v.sku,
        price: v.price,
        stock_quantity: v.stockQuantity,
        status: v.status,
      })),
    };
  }

  async createProduct(context: RequestContext, input: Record<string, unknown>): Promise<unknown> {
    if (!context.shop_id) {
      throw new ForbiddenError('Seller shop is required');
    }
    const rawVariants = Array.isArray(input.variants) ? input.variants : [];
    if (!rawVariants.length) {
      throw new ValidationError('At least one variant is required');
    }

    // RB-LB11: Check duplicate SKU within request payload
    const payloadSkus = new Set<string>();
    for (const raw of rawVariants) {
      const sku = String(raw?.sku ?? '').trim();
      if (!sku) {
        throw new ValidationError('Variant SKU is required');
      }
      if (payloadSkus.has(sku)) {
        throw new SkuConflictError(`Duplicate SKU '${sku}' in request variants`);
      }
      payloadSkus.add(sku);

      // QD05: price > 0
      const priceNum = Number(raw.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        throw new ValidationError('Variant price must be greater than 0');
      }

      // QD06: stock_quantity >= 0
      const stock = Number(raw.stock_quantity ?? 0);
      if (!Number.isInteger(stock) || stock < 0) {
        throw new StockInvalidError('Variant stock quantity must be a non-negative integer');
      }
    }

    // RB-LB11: Check duplicate SKU in the same shop (cross-shop allowed)
    const existingSkuRes = await this.pool.query(
      `SELECT v.sku 
       FROM product_variants v 
       JOIN products p ON v.product_id = p.product_id 
       WHERE p.shop_id = $1 AND v.sku = ANY($2::text[])`,
      [context.shop_id, Array.from(payloadSkus)],
    );
    if (existingSkuRes.rows.length > 0) {
      throw new SkuConflictError(`SKU '${existingSkuRes.rows[0].sku}' already exists in this shop`);
    }

    const now = new Date().toISOString();
    const productId = crypto.randomUUID();
    const product: Product = {
      productId,
      shopId: context.shop_id,
      categoryId: String(input.category_id),
      productName: String(input.product_name),
      description: input.description == null ? null : String(input.description),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const variants: ProductVariant[] = rawVariants.map((raw: any) => ({
      variantId: crypto.randomUUID(),
      productId,
      variantName: String(raw.variant_name),
      variantValue: raw.variant_value == null ? null : String(raw.variant_value),
      sku: String(raw.sku).trim(),
      price: String(raw.price),
      stockQuantity: Number(raw.stock_quantity ?? 0),
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    }));

    const rawImages = Array.isArray(input.images) ? input.images : [];
    const images: ProductImage[] = rawImages.map((img: any, index: number) => {
      const url = typeof img === 'string' ? img : String(img?.image_url ?? '');
      const sortOrder = typeof img === 'object' && img?.sort_order !== undefined ? Number(img.sort_order) : index;
      if (!Number.isInteger(sortOrder) || sortOrder < 0) {
        throw new ValidationError('Image sortOrder must be a non-negative integer');
      }
      return {
        imageId: crypto.randomUUID(),
        productId,
        imageUrl: url,
        sortOrder,
      };
    });

    await this.products.create(product, variants, images);
    return {
      product_id: product.productId,
      shop_id: product.shopId,
      category_id: product.categoryId,
      product_name: product.productName,
      description: product.description,
      status: product.status,
      variants: variants.map((v) => ({
        variant_id: v.variantId,
        variant_name: v.variantName,
        variant_value: v.variantValue,
        sku: v.sku,
        price: v.price,
        stock_quantity: v.stockQuantity,
        status: v.status,
      })),
    };
  }

  async updateVariantStock(
    context: RequestContext,
    variantId: string,
    input: Record<string, unknown>,
  ): Promise<unknown> {
    if (!context.shop_id) {
      throw new ForbiddenError('Seller shop is required');
    }
    const quantity = input.quantity;
    if (quantity === undefined || !Number.isInteger(quantity) || Number(quantity) < 0) {
      throw new StockInvalidError('Invalid stock quantity. Must be a non-negative integer.');
    }

    // QD04, RB-LQH07: Check existence and shop ownership
    const variantRes = await this.pool.query(
      `SELECT v.variant_id, p.shop_id 
       FROM product_variants v 
       JOIN products p ON v.product_id = p.product_id 
       WHERE v.variant_id = $1`,
      [variantId],
    );

    if (variantRes.rows.length === 0) {
      throw new ResourceNotFoundError(`Variant ${variantId} not found`);
    }

    if (variantRes.rows[0].shop_id !== context.shop_id) {
      throw new ForbiddenError('Variant belongs to another shop');
    }

    const result = await this.pool.query(
      `UPDATE product_variants SET stock_quantity = $1, updated_at = now() 
       WHERE variant_id = $2 
       RETURNING variant_id, stock_quantity`,
      [Number(quantity), variantId],
    );

    return {
      variant_id: result.rows[0].variant_id,
      stock_quantity: Number(result.rows[0].stock_quantity),
    };
  }
}
