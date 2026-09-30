import type { Pool, PoolClient } from 'pg';
import type { RequestContext } from '../../../contracts/request-context.contract.ts';
import { PgCategoryRepository, PgProductRepository, PgProductVariantRepository } from '../repositories/pg-catalog.repository.ts';
import type { Product, ProductImage, ProductVariant } from '../domain/types.ts';
import {
  ValidationError,
  ForbiddenError,
  ResourceNotFoundError,
  SkuConflictError,
  StockInvalidError,
} from '../domain/errors.ts';
import { withTransaction } from '../../../../db/transaction.ts';
import { attachFinalizedMedia } from '../../../../db/media-lifecycle.ts';

const decimal = /^\d+(\.\d{1,2})?$/;
const objectValue = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};

export class PgCatalogHttpService {
  private readonly products: PgProductRepository;
  private readonly variants: PgProductVariantRepository;
  private readonly categories: PgCategoryRepository;

  constructor(private readonly pool: Pool) {
    this.products = new PgProductRepository(pool);
    this.variants = new PgProductVariantRepository(pool);
    this.categories = new PgCategoryRepository(pool);
  }

  async listCategories() {
    return (await this.categories.findActive()).map(category => ({
      category_id: category.categoryId,
      parent_category_id: category.parentCategoryId,
      category_name: category.categoryName,
      description: category.description,
    }));
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

    const imagesRes = await this.pool.query(
      'SELECT image_id, image_url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
      [productId],
    );

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
      images: imagesRes.rows.map((img) => ({
        image_id: img.image_id,
        image_url: img.image_url,
        sort_order: Number(img.sort_order),
      })),
      image_url: imagesRes.rows[0]?.image_url ?? null,
    };
  }

  async createProduct(
    context: RequestContext,
    input: Record<string, unknown>,
    client?: PoolClient,
  ): Promise<unknown> {
    if (!context.shop_id) {
      throw new ForbiddenError('Seller shop is required');
    }
    const rawVariants: unknown[] = Array.isArray(input.variants) ? input.variants : [];
    if (!rawVariants.length) {
      throw new ValidationError('At least one variant is required');
    }

    // RB-LB11: Check duplicate SKU within request payload
    const payloadSkus = new Set<string>();
    for (const value of rawVariants) {
      const raw = objectValue(value);
      const sku = String(raw.sku ?? '').trim();
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

    const requestedProductId = typeof input.product_id === 'string' ? input.product_id : undefined;
    if (requestedProductId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedProductId)) {
      throw new ValidationError('product_id must be a valid UUID');
    }
    const now = new Date().toISOString();
    const productId = requestedProductId ?? crypto.randomUUID();
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

    const variants: ProductVariant[] = rawVariants.map((value) => {
      const raw = objectValue(value);
      return ({
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
      });
    });

    const rawImages: unknown[] = Array.isArray(input.images) ? input.images : [];
    const mediaAttachments = rawImages.flatMap((value) => {
      const image = objectValue(value);
      if (typeof image.media_id !== 'string') return [];
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(image.media_id)) {
        throw new ValidationError('Image media_id must be a valid UUID');
      }
      return [{ mediaId: image.media_id, imageUrl: String(image.image_url ?? '') }];
    });
    const images: ProductImage[] = rawImages.map((img, index: number) => {
      const image = objectValue(img);
      const url = typeof img === 'string' ? img : String(image.image_url ?? '');
      const sortOrder = image.sort_order !== undefined ? Number(image.sort_order) : index;
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

    const executeInTx = async (txClient: PoolClient) => {
      // Synchronize per shop to prevent concurrent SKU insertion race condition (T3-P3-01)
      const shopLock = await txClient.query(
        'SELECT shop_id FROM shops WHERE shop_id = $1 FOR UPDATE',
        [context.shop_id],
      );
      if (shopLock.rows.length === 0) {
        throw new ResourceNotFoundError(`Shop ${context.shop_id} not found`);
      }

      // Check duplicate SKU in the same shop (cross-shop allowed)
      const existingSkuRes = await txClient.query(
        `SELECT v.sku 
         FROM product_variants v 
         JOIN products p ON v.product_id = p.product_id 
         WHERE p.shop_id = $1 AND v.sku = ANY($2::text[])`,
        [context.shop_id, Array.from(payloadSkus)],
      );
      if (existingSkuRes.rows.length > 0) {
        throw new SkuConflictError(`SKU '${existingSkuRes.rows[0].sku}' already exists in this shop`);
      }

      const storageUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
      for (const media of mediaAttachments) {
        const registered = await txClient.query<{
          owner_id: string; purpose: string; bucket_id: string; object_path: string; status: string;
        }>(
          'SELECT owner_id,purpose,bucket_id,object_path,status FROM media_uploads WHERE media_id=$1 FOR UPDATE',
          [media.mediaId],
        );
        const row = registered.rows[0];
        const path = row?.object_path;
        const publicUrl = row && storageUrl
          ? `${storageUrl}/storage/v1/object/public/${row.bucket_id}/${path}`
          : '';
        if (!row || row.owner_id !== context.user_id || row.purpose !== 'PRODUCT'
          || row.bucket_id !== 'product-media' || row.status !== 'FINALIZED'
          || !path?.startsWith(`shops/${context.shop_id}/products/${productId}/${media.mediaId}.`)
          || media.imageUrl !== publicUrl) {
          throw new ValidationError('Product image must reference a finalized upload owned by this seller and draft product');
        }
      }

      await this.products.create(product, variants, images, txClient);
      for (const media of mediaAttachments) {
        await attachFinalizedMedia(txClient, {
          mediaId: media.mediaId,
          ownerId: context.user_id,
          purpose: 'PRODUCT',
          resource: { kind: 'PRODUCT', shopId: context.shop_id!, productId },
        });
      }
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
    };

    if (client) {
      return await executeInTx(client);
    }
    return await withTransaction(this.pool, executeInTx);
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

  async listSellerProducts(
    context: RequestContext,
    input: Record<string, unknown> = {},
  ): Promise<unknown> {
    if (!context.shop_id) {
      throw new ForbiddenError('Seller shop is required');
    }
    const conditions: string[] = ['p.shop_id = $1'];
    const params: unknown[] = [context.shop_id];

    if (input.status) {
      params.push(String(input.status));
      conditions.push(`p.status = $${params.length}`);
    }

    if (input.search) {
      params.push(`%${String(input.search)}%`);
      conditions.push(`p.product_name ILIKE $${params.length}`);
    }

    const query = `
      SELECT
        p.product_id,
        p.shop_id,
        p.category_id,
        p.product_name,
        p.description,
        p.status,
        p.created_at,
        p.updated_at,
        COALESCE(MIN(v.price), 0)::text AS min_price,
        COALESCE(MAX(v.price), 0)::text AS max_price,
        COALESCE(SUM(v.stock_quantity), 0)::int AS total_stock,
        (SELECT image_url FROM product_images WHERE product_id = p.product_id ORDER BY sort_order ASC LIMIT 1) AS image_url
      FROM products p
      LEFT JOIN product_variants v ON p.product_id = v.product_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY p.product_id
      ORDER BY p.created_at DESC
    `;

    const res = await this.pool.query(query, params);
    return res.rows.map((row) => ({
      product_id: row.product_id,
      product_name: row.product_name,
      shop_id: row.shop_id,
      category_id: row.category_id,
      min_price: String(row.min_price),
      max_price: String(row.max_price),
      total_stock: Number(row.total_stock),
      image_url: row.image_url,
      status: row.status,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  }

  async updateProductStatus(
    context: RequestContext,
    productId: string,
    status: string,
  ): Promise<unknown> {
    if (!context.shop_id) {
      throw new ForbiddenError('Seller shop is required');
    }
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new ValidationError('Status must be ACTIVE or INACTIVE');
    }

    const prodRes = await this.pool.query(
      'SELECT product_id, shop_id FROM products WHERE product_id = $1',
      [productId],
    );
    if (prodRes.rows.length === 0) {
      throw new ResourceNotFoundError(`Product ${productId} not found`);
    }
    if (prodRes.rows[0].shop_id !== context.shop_id) {
      throw new ForbiddenError('Product belongs to another shop');
    }

    const updated = await this.products.updateStatus(productId, status as 'ACTIVE' | 'INACTIVE');
    return {
      product_id: updated.productId,
      shop_id: updated.shopId,
      status: updated.status,
      updated_at: updated.updatedAt,
    };
  }

  async listAllCategories(): Promise<unknown[]> {
    const res = await this.pool.query(
      'SELECT * FROM categories ORDER BY (parent_category_id IS NOT NULL), category_name ASC',
    );
    return res.rows.map((r) => ({
      category_id: r.category_id,
      parent_category_id: r.parent_category_id,
      category_name: r.category_name,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  async createCategory(input: Record<string, unknown>): Promise<unknown> {
    const name = String(input.name ?? input.category_name ?? '').trim();
    if (!name) {
      throw new ValidationError('Category name is required');
    }

    const parentId = input.parent_id ?? input.parent_category_id ? String(input.parent_id ?? input.parent_category_id) : null;
    if (parentId) {
      const parentRes = await this.pool.query(
        'SELECT category_id, parent_category_id FROM categories WHERE category_id = $1',
        [parentId],
      );
      if (parentRes.rows.length === 0) {
        throw new ResourceNotFoundError(`Parent category ${parentId} not found`);
      }
      if (parentRes.rows[0].parent_category_id !== null) {
        throw new ValidationError('Category hierarchy cannot exceed 2 levels (RB-KN04)');
      }
    }

    const categoryId = crypto.randomUUID();
    const now = new Date().toISOString();
    const status = input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const description = input.description ? String(input.description) : null;

    const res = await this.pool.query(
      `INSERT INTO categories (category_id, parent_category_id, category_name, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [categoryId, parentId, name, description, status, now, now],
    );

    const row = res.rows[0];
    return {
      category_id: row.category_id,
      parent_category_id: row.parent_category_id,
      category_name: row.category_name,
      description: row.description,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async updateCategory(categoryId: string, input: Record<string, unknown>): Promise<unknown> {
    const existing = await this.pool.query('SELECT * FROM categories WHERE category_id = $1', [categoryId]);
    if (existing.rows.length === 0) {
      throw new ResourceNotFoundError(`Category ${categoryId} not found`);
    }

    const name = input.name !== undefined || input.category_name !== undefined
      ? String(input.name ?? input.category_name).trim()
      : existing.rows[0].category_name;
    if (!name) {
      throw new ValidationError('Category name cannot be empty');
    }

    let parentId = existing.rows[0].parent_category_id;
    if (input.parent_id !== undefined || input.parent_category_id !== undefined) {
      const rawParent = input.parent_id ?? input.parent_category_id;
      parentId = rawParent ? String(rawParent) : null;
    }

    if (parentId) {
      if (parentId === categoryId) {
        throw new ValidationError('Category cannot be its own parent');
      }
      const parentRes = await this.pool.query(
        'SELECT category_id, parent_category_id FROM categories WHERE category_id = $1',
        [parentId],
      );
      if (parentRes.rows.length === 0) {
        throw new ResourceNotFoundError(`Parent category ${parentId} not found`);
      }
      if (parentRes.rows[0].parent_category_id !== null) {
        throw new ValidationError('Category hierarchy cannot exceed 2 levels (RB-KN04)');
      }
      const childrenRes = await this.pool.query(
        'SELECT category_id FROM categories WHERE parent_category_id = $1 LIMIT 1',
        [categoryId],
      );
      if (childrenRes.rows.length > 0) {
        throw new ValidationError('Cannot make a category with existing subcategories into a child');
      }
    }

    const description = input.description !== undefined
      ? (input.description ? String(input.description) : null)
      : existing.rows[0].description;

    const res = await this.pool.query(
      `UPDATE categories SET category_name = $1, parent_category_id = $2, description = $3, updated_at = now()
       WHERE category_id = $4
       RETURNING *`,
      [name, parentId, description, categoryId],
    );

    const row = res.rows[0];
    return {
      category_id: row.category_id,
      parent_category_id: row.parent_category_id,
      category_name: row.category_name,
      description: row.description,
      status: row.status,
      updated_at: row.updated_at,
    };
  }

  async updateCategoryStatus(categoryId: string, status: string): Promise<unknown> {
    if (status !== 'ACTIVE' && status !== 'INACTIVE') {
      throw new ValidationError('Status must be ACTIVE or INACTIVE');
    }
    const res = await this.pool.query(
      'UPDATE categories SET status = $1, updated_at = now() WHERE category_id = $2 RETURNING *',
      [status, categoryId],
    );
    if (res.rows.length === 0) {
      throw new ResourceNotFoundError(`Category ${categoryId} not found`);
    }
    const row = res.rows[0];
    return {
      category_id: row.category_id,
      status: row.status,
      updated_at: row.updated_at,
    };
  }
}
