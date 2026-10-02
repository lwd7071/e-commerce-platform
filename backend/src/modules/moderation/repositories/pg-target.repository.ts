import type { Pool, PoolClient } from 'pg';
import type {
  AdminShopItem,
  AdminUserItem,
  AdminModerationProduct,
  AdminModerationReview,
  ITargetLookupRepository,
  ModerationRecord,
  ShopStatus,
  ShopStatusUpdateResult,
  UserStatus,
  UserStatusUpdateResult
} from '../domain/moderation.types.ts';
import { NotFoundError } from '../../../platform/errors/app-error.ts';

type Queryable = Pool | PoolClient;

export class PgModerationTargetRepository implements ITargetLookupRepository {
  constructor(private readonly pool: Pool) {}

  private getExecutor(trx?: unknown): Queryable {
    if (trx && typeof (trx as Queryable).query === 'function') {
      return trx as Queryable;
    }
    return this.pool;
  }

  async userExists(userId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM app_users WHERE user_id = $1', [userId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const res = await this.pool.query('SELECT status FROM app_users WHERE user_id = $1', [userId]);
    if (!res.rows || res.rows.length === 0) return null;
    return res.rows[0].status as UserStatus;
  }

  async getUserRole(userId: string): Promise<'BUYER' | 'SELLER' | 'ADMIN' | null> {
    const res = await this.pool.query('SELECT role FROM app_users WHERE user_id = $1', [userId]);
    if (!res.rows || res.rows.length === 0) return null;
    return res.rows[0].role as 'BUYER' | 'SELLER' | 'ADMIN';
  }

  async updateUserStatus(trx: unknown, userId: string, status: UserStatus): Promise<UserStatusUpdateResult> {
    const executor = this.getExecutor(trx);
    const res = await executor.query(
      'UPDATE app_users SET status = $1, updated_at = NOW() WHERE user_id = $2 RETURNING user_id, status, updated_at',
      [status, userId]
    );
    if (!res.rows || res.rows.length === 0) {
      throw new NotFoundError(`User with id '${userId}' not found for status update`);
    }
    const row = res.rows[0];
    return {
      user_id: row.user_id,
      status: row.status as UserStatus,
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async shopExists(shopId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM shops WHERE shop_id = $1', [shopId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getShopStatus(shopId: string): Promise<ShopStatus | null> {
    const res = await this.pool.query('SELECT status FROM shops WHERE shop_id = $1', [shopId]);
    if (!res.rows || res.rows.length === 0) return null;
    return res.rows[0].status as ShopStatus;
  }

  async hasRequiredShopProfile(trx: unknown, shopId: string): Promise<boolean> {
    const executor = this.getExecutor(trx);
    const res = await executor.query(
      `SELECT 1 FROM shops
       WHERE shop_id = $1
         AND NULLIF(BTRIM(pickup_address), '') IS NOT NULL
         AND NULLIF(BTRIM(contact_phone), '') IS NOT NULL
       FOR UPDATE`,
      [shopId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async updateShopStatus(trx: unknown, shopId: string, status: ShopStatus): Promise<ShopStatusUpdateResult> {
    const executor = this.getExecutor(trx);
    const res = await executor.query(
      'UPDATE shops SET status = $1, updated_at = NOW() WHERE shop_id = $2 RETURNING shop_id, status, updated_at',
      [status, shopId]
    );
    if (!res.rows || res.rows.length === 0) {
      throw new NotFoundError(`Shop with id '${shopId}' not found for status update`);
    }
    const row = res.rows[0];
    return {
      shop_id: row.shop_id,
      status: row.status as ShopStatus,
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async listShops(params?: { status?: string; search?: string }): Promise<AdminShopItem[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params?.status && params.status !== 'ALL') {
      values.push(params.status);
      conditions.push(`s.status = $${values.length}`);
    }

    if (params?.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      conditions.push(`(s.shop_name ILIKE $${idx} OR u.email ILIKE $${idx} OR p.full_name ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        s.shop_id,
        s.owner_id,
        s.shop_name,
        s.description,
        s.logo_url,
        s.pickup_address,
        s.contact_phone,
        s.status,
        s.created_at,
        s.updated_at,
        u.email AS owner_email,
        p.full_name AS owner_name,
        COALESCE((SELECT count(*)::int FROM products pr WHERE pr.shop_id = s.shop_id), 0) AS product_count
      FROM shops s
      LEFT JOIN app_users u ON s.owner_id = u.user_id
      LEFT JOIN user_profiles p ON s.owner_id = p.user_id
      ${whereClause}
      ORDER BY 
        CASE WHEN s.status = 'PENDING' THEN 0 ELSE 1 END,
        s.created_at DESC
    `;

    const res = await this.pool.query(query, values);
    return res.rows.map(row => ({
      shop_id: row.shop_id,
      owner_id: row.owner_id,
      shop_name: row.shop_name,
      description: row.description ?? null,
      logo_url: row.logo_url ?? null,
      pickup_address: row.pickup_address ?? null,
      contact_phone: row.contact_phone ?? null,
      status: row.status as ShopStatus,
      product_count: Number(row.product_count || 0),
      owner_email: row.owner_email ?? undefined,
      owner_name: row.owner_name ?? undefined,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    }));
  }

  async listUsers(params?: { role?: string; status?: string; search?: string }): Promise<AdminUserItem[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params?.role && params.role !== 'ALL') {
      values.push(params.role);
      conditions.push(`u.role = $${values.length}`);
    }

    if (params?.status && params.status !== 'ALL') {
      values.push(params.status);
      conditions.push(`u.status = $${values.length}`);
    }

    if (params?.search && params.search.trim()) {
      values.push(`%${params.search.trim()}%`);
      const idx = values.length;
      conditions.push(`(u.email ILIKE $${idx} OR p.full_name ILIKE $${idx} OR u.user_id::text ILIKE $${idx})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        u.user_id,
        u.email,
        COALESCE(p.full_name, u.email) AS full_name,
        u.role,
        u.status,
        u.created_at,
        u.updated_at
      FROM app_users u
      LEFT JOIN user_profiles p ON u.user_id = p.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
    `;

    const res = await this.pool.query(query, values);
    return res.rows.map(row => ({
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      role: row.role as 'BUYER' | 'SELLER' | 'ADMIN',
      status: row.status as UserStatus,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    }));
  }

  async getUserDetail(userId: string): Promise<AdminUserItem | null> {
    const res = await this.pool.query(
      `SELECT u.user_id, u.email, COALESCE(p.full_name, split_part(u.email, '@', 1)) as full_name,
              u.role, u.status, u.created_at, u.updated_at
         FROM app_users u
         LEFT JOIN user_profiles p ON u.user_id = p.user_id
        WHERE u.user_id = $1`,
      [userId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: row.user_id,
      email: row.email,
      full_name: row.full_name,
      role: row.role as 'BUYER' | 'SELLER' | 'ADMIN',
      status: row.status as UserStatus,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async getShopDetail(shopId: string): Promise<AdminShopItem | null> {
    const res = await this.pool.query(
      `SELECT s.shop_id, s.owner_id, s.shop_name, s.description, s.logo_url,
              s.pickup_address, s.contact_phone, s.status, s.created_at, s.updated_at,
              u.email as owner_email,
              COALESCE(p.full_name, split_part(u.email, '@', 1)) as owner_name,
              COUNT(pr.product_id)::int as product_count
         FROM shops s
         JOIN app_users u ON s.owner_id = u.user_id
         LEFT JOIN user_profiles p ON u.user_id = p.user_id
         LEFT JOIN products pr ON s.shop_id = pr.shop_id
        WHERE s.shop_id = $1
        GROUP BY s.shop_id, u.email, p.full_name`,
      [shopId],
    );
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      shop_id: row.shop_id,
      owner_id: row.owner_id,
      shop_name: row.shop_name,
      description: row.description,
      logo_url: row.logo_url,
      pickup_address: row.pickup_address,
      contact_phone: row.contact_phone,
      status: row.status as ShopStatus,
      product_count: Number(row.product_count),
      owner_email: row.owner_email,
      owner_name: row.owner_name,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async listModerationProducts(params?: { status?: string; search?: string }): Promise<AdminModerationProduct[]> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (params?.status && params.status !== 'ALL') { values.push(params.status); where.push(`pr.status = $${values.length}`); }
    if (params?.search?.trim()) { values.push(`%${params.search.trim()}%`); where.push(`(pr.product_name ILIKE $${values.length} OR s.shop_name ILIKE $${values.length})`); }
    const res = await this.pool.query(
      `SELECT pr.product_id, pr.product_name, s.shop_name, pr.status, pr.created_at,
              (SELECT MIN(pv.price)::text FROM product_variants pv WHERE pv.product_id = pr.product_id AND pv.status = 'ACTIVE') AS min_price
       FROM products pr JOIN shops s ON s.shop_id = pr.shop_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY pr.created_at DESC, pr.product_id ASC`, values,
    );
    return res.rows.map((row) => ({ ...row, status: row.status, created_at: new Date(row.created_at).toISOString() }));
  }

  async listModerationReviews(params?: { status?: string; search?: string }): Promise<AdminModerationReview[]> {
    const values: unknown[] = [];
    const where: string[] = [];
    if (params?.status && params.status !== 'ALL') { values.push(params.status); where.push(`r.status = $${values.length}`); }
    if (params?.search?.trim()) { values.push(`%${params.search.trim()}%`); where.push(`(p.product_name ILIKE $${values.length} OR r.content ILIKE $${values.length})`); }
    const res = await this.pool.query(
      `SELECT r.review_id, r.product_id, p.product_name, r.buyer_id, r.rating, r.content, r.status, r.created_at
       FROM reviews r JOIN products p ON p.product_id = r.product_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.created_at DESC, r.review_id ASC`, values,
    );
    return res.rows.map((row) => ({ ...row, rating: Number(row.rating), status: row.status, created_at: new Date(row.created_at).toISOString() }));
  }

  async productExists(productId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM products WHERE product_id = $1', [productId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getProductStatus(productId: string): Promise<'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'HIDDEN' | null> {
    const res = await this.pool.query('SELECT status FROM products WHERE product_id = $1', [productId]);
    return res.rows[0]?.status ?? null;
  }

  async updateProductStatus(trx: unknown, productId: string, status: 'ACTIVE' | 'HIDDEN') {
    const res = await this.getExecutor(trx).query(
      'UPDATE products SET status = $1, updated_at = NOW() WHERE product_id = $2 RETURNING product_id, status, updated_at',
      [status, productId],
    );
    if (!res.rows[0]) throw new NotFoundError(`Product with id '${productId}' not found for moderation`);
    return { product_id: res.rows[0].product_id, status: res.rows[0].status as 'ACTIVE' | 'HIDDEN', updated_at: new Date(res.rows[0].updated_at).toISOString() };
  }

  async reviewExists(reviewId: string): Promise<boolean> {
    const res = await this.pool.query('SELECT 1 FROM reviews WHERE review_id = $1', [reviewId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getReviewStatus(reviewId: string): Promise<'VISIBLE' | 'HIDDEN' | null> {
    const res = await this.pool.query('SELECT status FROM reviews WHERE review_id = $1', [reviewId]);
    return res.rows[0]?.status ?? null;
  }

  async updateReviewStatus(trx: unknown, reviewId: string, status: 'VISIBLE' | 'HIDDEN') {
    const res = await this.getExecutor(trx).query(
      'UPDATE reviews SET status = $1, updated_at = NOW() WHERE review_id = $2 RETURNING review_id, status, updated_at',
      [status, reviewId],
    );
    if (!res.rows[0]) throw new NotFoundError(`Review with id '${reviewId}' not found for moderation`);
    return { review_id: res.rows[0].review_id, status: res.rows[0].status as 'VISIBLE' | 'HIDDEN', updated_at: new Date(res.rows[0].updated_at).toISOString() };
  }

  async insertModerationRecord(trx: unknown, record: ModerationRecord): Promise<void> {
    const executor = this.getExecutor(trx);
    await executor.query(
      `INSERT INTO moderation_records (moderation_id, target_type, target_id, reason, action, admin_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        record.moderation_id,
        record.target_type,
        record.target_id,
        record.reason,
        record.action,
        record.admin_id,
      ]
    );
  }
}
