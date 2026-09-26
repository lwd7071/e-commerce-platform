import type { Pool, PoolClient } from 'pg';
import { SkuConflictError } from '../domain/errors.ts';
import { ValidationError } from '../domain/errors.ts';
import type {
  UUID,
  Shop,
  ShopStatus,
  Category,
  Product,
  ProductStatus,
  ProductVariant,
  ProductImage,
  CategoryStatus,
  VariantStatus,
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

type DatabaseRow = Record<string, unknown>;
const isoString = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);
const nullableString = (value: unknown): string | null => value == null ? null : String(value);

// Helper mappers from DB snake_case to Domain camelCase
export const mapShopRow = (row: DatabaseRow): Shop => ({
  shopId: String(row.shop_id),
  ownerId: String(row.owner_id),
  shopName: String(row.shop_name),
  description: nullableString(row.description),
  logoUrl: nullableString(row.logo_url),
  pickupAddress: String(row.pickup_address),
  contactPhone: String(row.contact_phone),
  status: row.status as ShopStatus,
  createdAt: isoString(row.created_at),
  updatedAt: isoString(row.updated_at),
});

export const mapCategoryRow = (row: DatabaseRow): Category => ({
  categoryId: String(row.category_id),
  parentCategoryId: nullableString(row.parent_category_id),
  categoryName: String(row.category_name),
  description: nullableString(row.description),
  status: row.status as CategoryStatus,
  createdAt: isoString(row.created_at),
  updatedAt: isoString(row.updated_at),
});

export const mapProductRow = (row: DatabaseRow): Product => ({
  productId: String(row.product_id),
  shopId: String(row.shop_id),
  categoryId: String(row.category_id),
  productName: String(row.product_name),
  description: nullableString(row.description),
  status: row.status as ProductStatus,
  createdAt: isoString(row.created_at),
  updatedAt: isoString(row.updated_at),
});

export const mapVariantRow = (row: DatabaseRow): ProductVariant => ({
  variantId: String(row.variant_id),
  productId: String(row.product_id),
  variantName: String(row.variant_name),
  variantValue: nullableString(row.variant_value),
  sku: String(row.sku),
  price: String(row.price),
  stockQuantity: Number(row.stock_quantity),
  status: row.status as VariantStatus,
  createdAt: isoString(row.created_at),
  updatedAt: isoString(row.updated_at),
  productName: row.product_name == null ? undefined : String(row.product_name),
  shopId: row.shop_id == null ? undefined : String(row.shop_id),
  shopOwnerId: row.shop_owner_id == null ? undefined : String(row.shop_owner_id),
});

export class PgShopRepository implements IShopRepository {
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(shopId: UUID): Promise<Shop | null> {
    const res = await this.pool.query('SELECT * FROM shops WHERE shop_id = $1', [shopId]);
    return res.rows[0] ? mapShopRow(res.rows[0]) : null;
  }

  async findByOwnerId(ownerId: UUID): Promise<Shop | null> {
    const res = await this.pool.query('SELECT * FROM shops WHERE owner_id = $1', [ownerId]);
    return res.rows[0] ? mapShopRow(res.rows[0]) : null;
  }

  async create(shop: Shop): Promise<Shop> {
    const query = `
      INSERT INTO shops (shop_id, owner_id, shop_name, description, logo_url, pickup_address, contact_phone, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      shop.shopId,
      shop.ownerId,
      shop.shopName,
      shop.description,
      shop.logoUrl,
      shop.pickupAddress,
      shop.contactPhone,
      shop.status,
      shop.createdAt,
      shop.updatedAt,
    ]);
    return mapShopRow(res.rows[0]);
  }

  async updateStatus(shopId: UUID, status: ShopStatus): Promise<Shop> {
    const res = await this.pool.query(
      'UPDATE shops SET status = $1, updated_at = now() WHERE shop_id = $2 RETURNING *',
      [status, shopId]
    );
    if (!res.rows[0]) throw new Error(`Shop ${shopId} not found`);
    return mapShopRow(res.rows[0]);
  }
}

export class PgCategoryRepository implements ICategoryRepository {
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(categoryId: UUID): Promise<Category | null> {
    const res = await this.pool.query('SELECT * FROM categories WHERE category_id = $1', [categoryId]);
    return res.rows[0] ? mapCategoryRow(res.rows[0]) : null;
  }

  async findRoots(): Promise<Category[]> {
    const res = await this.pool.query(
      'SELECT * FROM categories WHERE parent_category_id IS NULL ORDER BY category_name ASC'
    );
    return res.rows.map(mapCategoryRow);
  }

  async findChildren(parentId: UUID): Promise<Category[]> {
    const res = await this.pool.query(
      'SELECT * FROM categories WHERE parent_category_id = $1 ORDER BY category_name ASC',
      [parentId]
    );
    return res.rows.map(mapCategoryRow);
  }

  async create(category: Category): Promise<Category> {
    const query = `
      INSERT INTO categories (category_id, parent_category_id, category_name, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const res = await this.pool.query(query, [
      category.categoryId,
      category.parentCategoryId,
      category.categoryName,
      category.description,
      category.status,
      category.createdAt,
      category.updatedAt,
    ]);
    return mapCategoryRow(res.rows[0]);
  }
}

export class PgProductVariantRepository implements IProductVariantRepository {
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(variantId: UUID, client?: PoolClient): Promise<ProductVariant | null> {
    const runner = client ?? this.pool;
    const res = await runner.query(
      `SELECT v.*, p.product_name, p.shop_id, s.owner_id AS shop_owner_id
         FROM product_variants v
         JOIN products p ON p.product_id = v.product_id
         JOIN shops s ON s.shop_id = p.shop_id
        WHERE v.variant_id = $1`,
      [variantId],
    );
    return res.rows[0] ? mapVariantRow(res.rows[0]) : null;
  }

  async findByProductId(productId: UUID): Promise<ProductVariant[]> {
    const res = await this.pool.query('SELECT * FROM product_variants WHERE product_id = $1 ORDER BY price ASC', [
      productId,
    ]);
    return res.rows.map(mapVariantRow);
  }

  async findBySku(shopId: UUID, sku: string): Promise<ProductVariant | null> {
    const query = `
      SELECT v.* FROM product_variants v
      JOIN products p ON v.product_id = p.product_id
      WHERE p.shop_id = $1 AND v.sku = $2
    `;
    const res = await this.pool.query(query, [shopId, sku]);
    return res.rows[0] ? mapVariantRow(res.rows[0]) : null;
  }

  async create(variant: ProductVariant, client?: PoolClient): Promise<ProductVariant> {
    const runner = client ?? this.pool;
    const query = `
      INSERT INTO product_variants (variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    const res = await runner.query(query, [
      variant.variantId,
      variant.productId,
      variant.variantName,
      variant.variantValue,
      variant.sku,
      variant.price,
      variant.stockQuantity,
      variant.status,
      variant.createdAt,
      variant.updatedAt,
    ]);
    return mapVariantRow(res.rows[0]);
  }

  async lockForUpdate(variantId: UUID, client?: PoolClient): Promise<ProductVariant | null> {
    const runner = client ?? this.pool;
    const res = await runner.query('SELECT * FROM product_variants WHERE variant_id = $1 FOR UPDATE', [variantId]);
    return res.rows[0] ? mapVariantRow(res.rows[0]) : null;
  }

  async deductStock(variantId: UUID, quantity: number, client?: PoolClient): Promise<void> {
    const runner = client ?? this.pool;
    const res = await runner.query(
      'UPDATE product_variants SET stock_quantity = stock_quantity - $1, updated_at = now() WHERE variant_id = $2',
      [quantity, variantId]
    );
    if (res.rowCount === 0) throw new Error(`Variant ${variantId} not found`);
  }
}

export class PgProductRepository implements IProductRepository {
  private pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findById(productId: UUID): Promise<Product | null> {
    const res = await this.pool.query('SELECT * FROM products WHERE product_id = $1', [productId]);
    return res.rows[0] ? mapProductRow(res.rows[0]) : null;
  }

  async findByShopId(shopId: UUID, filter?: ProductFilter): Promise<Product[]> {
    const conditions: string[] = ['shop_id = $1'];
    const params: unknown[] = [shopId];

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter?.categoryId) {
      params.push(filter.categoryId);
      conditions.push(`category_id = $${params.length}`);
    }

    const query = `SELECT * FROM products WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
    const res = await this.pool.query(query, params);
    return res.rows.map(mapProductRow);
  }

  async create(
    product: Product,
    variants: ProductVariant[],
    images: ProductImage[] = [],
    client?: PoolClient,
  ): Promise<Product> {
    const persist = async (runner: PoolClient) => {
      const skus = [...new Set(variants.map((variant) => variant.sku))].sort();
      for (const sku of skus) {
        const lockScope = JSON.stringify(['catalog-sku-v1', product.shopId, sku]);
        await runner.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [lockScope],
        );
      }

      const existingSku = await runner.query<{ sku: string }>(
        `SELECT v.sku
           FROM product_variants v
           JOIN products p ON p.product_id = v.product_id
          WHERE p.shop_id = $1 AND v.sku = ANY($2::text[])
          LIMIT 1`,
        [product.shopId, skus],
      );
      if (existingSku.rows[0]) {
        throw new SkuConflictError(`SKU '${existingSku.rows[0].sku}' already exists in this shop`);
      }

      const productQuery = `
        INSERT INTO products (product_id, shop_id, category_id, product_name, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const res = await runner.query(productQuery, [
        product.productId,
        product.shopId,
        product.categoryId,
        product.productName,
        product.description,
        product.status,
        product.createdAt,
        product.updatedAt,
      ]);

      for (const v of variants) {
        await runner.query(
          `INSERT INTO product_variants (variant_id, product_id, variant_name, variant_value, sku, price, stock_quantity, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            v.variantId,
            product.productId,
            v.variantName,
            v.variantValue,
            v.sku,
            v.price,
            v.stockQuantity,
            v.status,
            v.createdAt,
            v.updatedAt,
          ],
        );
      }

      for (const img of images) {
        await runner.query(
          `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [img.imageId, product.productId, img.imageUrl, img.sortOrder],
        );
      }

      return mapProductRow(res.rows[0]);
    };

    if (client) {
      return await persist(client);
    }

    const conn = await this.pool.connect();
    try {
      await conn.query('BEGIN');
      const created = await persist(conn);
      await conn.query('COMMIT');
      return created;
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  async updateStatus(productId: UUID, status: ProductStatus): Promise<Product> {
    const res = await this.pool.query(
      'UPDATE products SET status = $1, updated_at = now() WHERE product_id = $2 RETURNING *',
      [status, productId]
    );
    if (!res.rows[0]) throw new Error(`Product ${productId} not found`);
    return mapProductRow(res.rows[0]);
  }

  async queryPublic(filter: PublicProductFilter): Promise<{ items: PublicProductSummary[]; total: number; nextCursor?: string | null }> {
    const whereConditions: string[] = [
      "p.status = 'ACTIVE'",
      "s.status = 'ACTIVE'",
      "c.status = 'ACTIVE'",
      "v.status = 'ACTIVE'",
    ];
    const params: unknown[] = [];

    if (filter.categoryId) {
      params.push(filter.categoryId);
      whereConditions.push(`p.category_id = $${params.length}`);
    }

    if (filter.search) {
      params.push(`%${filter.search}%`);
      whereConditions.push(`p.product_name ILIKE $${params.length}`);
    }

    const havingConditions: string[] = [];
    if (filter.minPrice !== undefined) {
      params.push(filter.minPrice);
      havingConditions.push(`MAX(v.price) >= $${params.length}`);
    }
    if (filter.maxPrice !== undefined) {
      params.push(filter.maxPrice);
      havingConditions.push(`MIN(v.price) <= $${params.length}`);
    }

    const havingClause = havingConditions.length > 0 ? `HAVING ${havingConditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY p.created_at DESC, p.product_id ASC';
    if (filter.sortBy === 'price_asc') {
      orderClause = 'ORDER BY min_price ASC, p.product_id ASC';
    } else if (filter.sortBy === 'price_desc') {
      orderClause = 'ORDER BY max_price DESC, p.product_id ASC';
    } else if (filter.sortBy === 'created_at_desc') {
      orderClause = 'ORDER BY p.created_at DESC, p.product_id ASC';
    }

    const countSql = `
      SELECT COUNT(*) as count FROM (
        SELECT p.product_id
        FROM products p
        JOIN shops s ON p.shop_id = s.shop_id
        JOIN categories c ON p.category_id = c.category_id
        JOIN product_variants v ON p.product_id = v.product_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY p.product_id
        ${havingClause}
      ) as sub
    `;
    const countRes = await this.pool.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const limit = filter.limit ?? 20;
    const offset = filter.cursor ? decodeCursor(filter.cursor) : (filter.offset ?? 0);
    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const dataSql = `
      SELECT 
        p.product_id,
        p.shop_id,
        p.category_id,
        p.product_name,
        p.description,
        p.created_at,
        MIN(v.price) as min_price,
        MAX(v.price) as max_price,
        SUM(v.stock_quantity)::int as total_stock,
        (
          SELECT image_url FROM product_images pi 
          WHERE pi.product_id = p.product_id 
          ORDER BY pi.sort_order ASC LIMIT 1
        ) as image_url
      FROM products p
      JOIN shops s ON p.shop_id = s.shop_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN product_variants v ON p.product_id = v.product_id
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY p.product_id, p.shop_id, p.category_id, p.product_name, p.description, p.created_at
      ${havingClause}
      ${orderClause}
      LIMIT $${limitParam} OFFSET $${offsetParam}
    `;

    const dataRes = await this.pool.query(dataSql, params);
    const items: PublicProductSummary[] = dataRes.rows.map((row: DatabaseRow) => ({
      productId: String(row.product_id),
      shopId: String(row.shop_id),
      categoryId: String(row.category_id),
      productName: String(row.product_name),
      description: nullableString(row.description),
      minPrice: Number(row.min_price).toFixed(2),
      maxPrice: Number(row.max_price).toFixed(2),
      totalStock: Number(row.total_stock),
      imageUrl: nullableString(row.image_url),
      createdAt: isoString(row.created_at),
    }));

    return { items, total, nextCursor: items.length === limit && offset + items.length < total ? encodeCursor(offset + items.length) : null };
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): number {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { v?: number; offset?: number };
    const offset = value.offset;
    if (value.v !== 1 || typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
      throw new ValidationError('Invalid cursor');
    }
    return offset;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Invalid cursor');
  }
}
