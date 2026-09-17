import type { Pool, PoolClient } from 'pg';
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

// Helper mappers from DB snake_case to Domain camelCase
export const mapShopRow = (row: any): Shop => ({
  shopId: row.shop_id,
  ownerId: row.owner_id,
  shopName: row.shop_name,
  description: row.description,
  logoUrl: row.logo_url,
  pickupAddress: row.pickup_address,
  contactPhone: row.contact_phone,
  status: row.status,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
});

export const mapCategoryRow = (row: any): Category => ({
  categoryId: row.category_id,
  parentCategoryId: row.parent_category_id,
  categoryName: row.category_name,
  description: row.description,
  status: row.status,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
});

export const mapProductRow = (row: any): Product => ({
  productId: row.product_id,
  shopId: row.shop_id,
  categoryId: row.category_id,
  productName: row.product_name,
  description: row.description,
  status: row.status,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
});

export const mapVariantRow = (row: any): ProductVariant => ({
  variantId: row.variant_id,
  productId: row.product_id,
  variantName: row.variant_name,
  variantValue: row.variant_value,
  sku: row.sku,
  price: String(row.price),
  stockQuantity: Number(row.stock_quantity),
  status: row.status,
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
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
    const res = await runner.query('SELECT * FROM product_variants WHERE variant_id = $1', [variantId]);
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
    const params: any[] = [shopId];

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

  async create(product: Product, variants: ProductVariant[], images: ProductImage[] = []): Promise<Product> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const productQuery = `
        INSERT INTO products (product_id, shop_id, category_id, product_name, description, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const res = await client.query(productQuery, [
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
        await client.query(
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
          ]
        );
      }

      for (const img of images) {
        await client.query(
          `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [img.imageId, product.productId, img.imageUrl, img.sortOrder]
        );
      }

      await client.query('COMMIT');
      return mapProductRow(res.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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

  async queryPublic(filter: PublicProductFilter): Promise<{ items: PublicProductSummary[]; total: number }> {
    const whereConditions: string[] = [
      "p.status = 'ACTIVE'",
      "s.status = 'ACTIVE'",
      "c.status = 'ACTIVE'",
      "v.status = 'ACTIVE'",
    ];
    const params: any[] = [];

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

    let orderClause = 'ORDER BY p.created_at DESC';
    if (filter.sortBy === 'price_asc') {
      orderClause = 'ORDER BY min_price ASC, p.created_at DESC';
    } else if (filter.sortBy === 'price_desc') {
      orderClause = 'ORDER BY max_price DESC, p.created_at DESC';
    } else if (filter.sortBy === 'created_at_desc') {
      orderClause = 'ORDER BY p.created_at DESC';
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
    const offset = filter.offset ?? 0;
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
    const items: PublicProductSummary[] = dataRes.rows.map((row: Record<string, any>) => ({
      productId: row.product_id,
      shopId: row.shop_id,
      categoryId: row.category_id,
      productName: row.product_name,
      description: row.description,
      minPrice: Number(row.min_price).toFixed(2),
      maxPrice: Number(row.max_price).toFixed(2),
      totalStock: Number(row.total_stock),
      imageUrl: row.image_url ?? null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));

    return { items, total };
  }
}
