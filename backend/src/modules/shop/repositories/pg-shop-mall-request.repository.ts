import type { Pool, PoolClient } from 'pg';
import type {
  ShopMallRequest,
  ShopMallRequestListItem,
  ShopMallRequestStatus,
} from '../domain/shop-mall-request.types.ts';

export interface CursorPayload {
  createdAt: string;
  requestId: string;
}

export function encodeCursor(createdAt: string, requestId: string): string {
  return Buffer.from(JSON.stringify({ createdAt, requestId })).toString('base64');
}

export function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.requestId === 'string') {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export class PgShopMallRequestRepository {
  constructor(private readonly pool: Pool) {}

  async insert(
    executor: Pool | PoolClient,
    data: { shop_id: string; seller_id: string; reason: string; document_url: string }
  ): Promise<ShopMallRequest> {
    const result = await executor.query(
      `INSERT INTO shop_mall_requests (shop_id, seller_id, reason, document_url, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING request_id, shop_id, seller_id, admin_id, reason, document_url, status,
                 admin_note, reviewed_at, cancelled_at, created_at, updated_at`,
      [data.shop_id, data.seller_id, data.reason, data.document_url]
    );
    return this.map(result.rows[0]);
  }

  async findShopForUpdate(
    client: PoolClient,
    shopId: string
  ): Promise<{ shop_id: string; owner_id: string; status: string; tier: string; tier_override: boolean } | null> {
    const result = await client.query(
      `SELECT shop_id, owner_id, status, COALESCE(tier, 'STANDARD') as tier, COALESCE(tier_override, false) as tier_override
       FROM shops
       WHERE shop_id = $1
       FOR UPDATE`,
      [shopId]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      shop_id: String(row.shop_id),
      owner_id: String(row.owner_id),
      status: String(row.status),
      tier: String(row.tier),
      tier_override: Boolean(row.tier_override),
    };
  }

  async findByIdForUpdate(client: PoolClient, requestId: string): Promise<ShopMallRequest | null> {
    const result = await client.query(
      `SELECT request_id, shop_id, seller_id, admin_id, reason, document_url, status,
              admin_note, reviewed_at, cancelled_at, created_at, updated_at
       FROM shop_mall_requests
       WHERE request_id = $1
       FOR UPDATE`,
      [requestId]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async findPendingByShopId(shopId: string): Promise<ShopMallRequest | null> {
    const result = await this.pool.query(
      `SELECT request_id, shop_id, seller_id, admin_id, reason, document_url, status,
              admin_note, reviewed_at, cancelled_at, created_at, updated_at
       FROM shop_mall_requests
       WHERE shop_id = $1 AND status = 'PENDING'`,
      [shopId]
    );
    return result.rows[0] ? this.map(result.rows[0]) : null;
  }

  async updateStatus(
    client: PoolClient,
    requestId: string,
    data: {
      status: ShopMallRequestStatus;
      admin_id?: string | null;
      admin_note?: string | null;
      reviewed_at?: Date | null;
      cancelled_at?: Date | null;
    }
  ): Promise<ShopMallRequest> {
    const result = await client.query(
      `UPDATE shop_mall_requests
       SET status = $2,
           admin_id = COALESCE($3, admin_id),
           admin_note = COALESCE($4, admin_note),
           reviewed_at = COALESCE($5, reviewed_at),
           cancelled_at = COALESCE($6, cancelled_at),
           updated_at = NOW()
       WHERE request_id = $1
       RETURNING request_id, shop_id, seller_id, admin_id, reason, document_url, status,
                 admin_note, reviewed_at, cancelled_at, created_at, updated_at`,
      [
        requestId,
        data.status,
        data.admin_id ?? null,
        data.admin_note ?? null,
        data.reviewed_at ? data.reviewed_at.toISOString() : null,
        data.cancelled_at ? data.cancelled_at.toISOString() : null,
      ]
    );
    return this.map(result.rows[0]);
  }

  async listByShop(
    shopId: string,
    limit: number,
    cursor?: string
  ): Promise<{ items: ShopMallRequest[]; next_cursor: string | null; has_more: boolean }> {
    const parsedCursor = decodeCursor(cursor);
    const params: unknown[] = [shopId, limit + 1];
    let cursorClause = '';

    if (parsedCursor) {
      params.push(parsedCursor.createdAt, parsedCursor.requestId);
      cursorClause = `AND (created_at < $3 OR (created_at = $3 AND request_id < $4))`;
    }

    const result = await this.pool.query(
      `SELECT request_id, shop_id, seller_id, admin_id, reason, document_url, status,
              admin_note, reviewed_at, cancelled_at, created_at, updated_at
       FROM shop_mall_requests
       WHERE shop_id = $1 ${cursorClause}
       ORDER BY created_at DESC, request_id DESC
       LIMIT $2`,
      params
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const items = rows.map((r) => this.map(r));

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(last.created_at, last.request_id);
    }

    return { items, next_cursor: nextCursor, has_more: hasMore };
  }

  async listForAdmin(
    filter: { status?: ShopMallRequestStatus; limit: number; cursor?: string }
  ): Promise<{ items: ShopMallRequestListItem[]; next_cursor: string | null; has_more: boolean }> {
    const parsedCursor = decodeCursor(filter.cursor);
    const params: unknown[] = [filter.limit + 1];
    const conditions: string[] = [];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`r.status = $${params.length}`);
    }

    if (parsedCursor) {
      params.push(parsedCursor.createdAt, parsedCursor.requestId);
      const c1 = params.length - 1;
      const c2 = params.length;
      conditions.push(`(r.created_at < $${c1} OR (r.created_at = $${c1} AND r.request_id < $${c2}))`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await this.pool.query(
      `SELECT r.request_id, r.shop_id, r.seller_id, r.admin_id, r.reason, r.document_url, r.status,
              r.admin_note, r.reviewed_at, r.cancelled_at, r.created_at, r.updated_at,
              s.shop_name, u.email as seller_email
       FROM shop_mall_requests r
       LEFT JOIN shops s ON s.shop_id = r.shop_id
       LEFT JOIN app_users u ON u.user_id = r.seller_id
       ${whereClause}
       ORDER BY r.created_at DESC, r.request_id DESC
       LIMIT $1`,
      params
    );

    const hasMore = result.rows.length > filter.limit;
    const rows = hasMore ? result.rows.slice(0, filter.limit) : result.rows;
    const items = rows.map((r) => ({
      ...this.map(r),
      shop_name: r.shop_name ? String(r.shop_name) : undefined,
      seller_email: r.seller_email ? String(r.seller_email) : undefined,
    }));

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = encodeCursor(last.created_at, last.request_id);
    }

    return { items, next_cursor: nextCursor, has_more: hasMore };
  }

  private map(row: Record<string, unknown>): ShopMallRequest {
    return {
      request_id: String(row.request_id),
      shop_id: String(row.shop_id),
      seller_id: String(row.seller_id),
      admin_id: row.admin_id == null ? null : String(row.admin_id),
      reason: String(row.reason),
      document_url: String(row.document_url),
      status: row.status as ShopMallRequestStatus,
      admin_note: row.admin_note == null ? null : String(row.admin_note),
      reviewed_at: row.reviewed_at == null ? null : new Date(row.reviewed_at as Date | string).toISOString(),
      cancelled_at: row.cancelled_at == null ? null : new Date(row.cancelled_at as Date | string).toISOString(),
      created_at: new Date(row.created_at as Date | string).toISOString(),
      updated_at: new Date(row.updated_at as Date | string).toISOString(),
    };
  }
}
