import type { Pool } from 'pg';
import { ValidationFailedError } from '../../../platform/errors/app-error.ts';

export class AdminReadService {
  constructor(private readonly pool: Pool) {}

  async listAuditLogsPage(input: { action?: string; target_type?: string; actor?: string; from?: string; to?: string; limit?: number; cursor?: string } = {}) {
    const limit = input.limit ?? 20;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationFailedError('limit must be from 1 to 100');
    const validTimestamp = (value: string) => !Number.isNaN(Date.parse(value));
    if ((input.from && !validTimestamp(input.from)) || (input.to && !validTimestamp(input.to)) || (input.from && input.to && input.from > input.to)) {
      throw new ValidationFailedError('from and to must be valid timestamps with from <= to');
    }
    let cursor: { created_at: string; log_id: string } | undefined;
    if (input.cursor) {
      try {
        const parsed = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')) as Partial<{ created_at: string; log_id: string }>;
        if (typeof parsed.created_at !== 'string' || !validTimestamp(parsed.created_at) || typeof parsed.log_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(parsed.log_id)) throw new Error('Invalid cursor');
        cursor = { created_at: parsed.created_at, log_id: parsed.log_id };
      } catch {
        throw new ValidationFailedError('Invalid audit cursor', { field: 'cursor' });
      }
    }
    const values: unknown[] = [];
    const where: string[] = [];
    for (const [column, value] of [['l.action', input.action], ['l.target_type', input.target_type], ['l.admin_id', input.actor]] as const) {
      if (value) { values.push(value); where.push(`${column}=$${values.length}`); }
    }
    if (input.from) { values.push(input.from); where.push(`l.created_at >= $${values.length}::timestamptz`); }
    if (input.to) { values.push(input.to); where.push(`l.created_at <= $${values.length}::timestamptz`); }
    if (cursor) {
      values.push(cursor.created_at); const createdAt = values.length;
      values.push(cursor.log_id); const logId = values.length;
      where.push(`(l.created_at < $${createdAt}::timestamptz OR (l.created_at = $${createdAt}::timestamptz AND l.log_id > $${logId}::uuid))`);
    }
    values.push(limit + 1);
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT l.log_id,l.action,l.target_type,l.target_id,l.reason,l.created_at,
              l.admin_id,u.email AS actor
         FROM admin_logs l JOIN app_users u ON u.user_id=l.admin_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY l.created_at DESC, l.log_id ASC LIMIT $${values.length}`,
      values,
    );
    const has_more = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    const last = rows.at(-1);
    const lastCreatedAt = last?.created_at instanceof Date ? last.created_at.toISOString() : String(last?.created_at ?? '');
    return {
      items: rows.map(row => ({
        id: String(row.log_id), action: String(row.action), targetType: row.target_type == null ? null : String(row.target_type),
        targetId: row.target_id == null ? null : String(row.target_id), reason: row.reason == null ? '' : String(row.reason),
        actor: String(row.actor), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      })),
      limit,
      has_more,
      next_cursor: has_more && last ? Buffer.from(JSON.stringify({ created_at: lastCreatedAt, log_id: String(last.log_id) }), 'utf8').toString('base64url') : null,
    };
  }

  async getOperationalReport(input: { from: string; to: string }) {
    const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    if (!isDate(input.from) || !isDate(input.to) || input.from > input.to) {
      throw new ValidationFailedError('from and to must be valid dates with from <= to');
    }
    const range = `created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AND created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
    const values = [input.from, input.to];
    const [statuses, daily, shops, products, moderation] = await Promise.all([
      this.pool.query<{ status: string; order_count: string }>(`SELECT status, COUNT(*)::text AS order_count FROM orders WHERE ${range} GROUP BY status ORDER BY status`, values),
      this.pool.query<{ local_day: string; order_count: string; gmv: string }>(`SELECT (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text AS local_day, COUNT(*)::text AS order_count, COALESCE(SUM(total_amount) FILTER (WHERE status = 'COMPLETED'), 0)::text AS gmv FROM orders WHERE ${range} GROUP BY local_day ORDER BY local_day`, values),
      this.pool.query<{ shop_name: string; order_count: string; gmv: string }>(`SELECT s.shop_name AS shop_name, COUNT(*)::text AS order_count, SUM(o.total_amount)::text AS gmv FROM orders o JOIN shops s ON s.shop_id=o.shop_id WHERE ${range.replaceAll('created_at', 'o.created_at')} AND o.status='COMPLETED' GROUP BY s.shop_id,s.shop_name ORDER BY SUM(o.total_amount) DESC,s.shop_id LIMIT 10`, values),
      this.pool.query<{ product_name: string; quantity_sold: string; gmv: string }>(`SELECT oi.product_name_snapshot AS product_name, SUM(oi.quantity)::text AS quantity_sold, SUM(oi.line_total)::text AS gmv FROM orders o JOIN order_items oi ON oi.order_id=o.order_id WHERE ${range.replaceAll('created_at', 'o.created_at')} AND o.status='COMPLETED' GROUP BY oi.product_id,oi.product_name_snapshot ORDER BY SUM(oi.quantity) DESC,oi.product_id LIMIT 10`, values),
      this.pool.query<{ action: string; count: string }>(`SELECT action, COUNT(*)::text AS count FROM moderation_records WHERE ${range} GROUP BY action ORDER BY action`, values),
    ]);
    return {
      from: input.from,
      to: input.to,
      ordersByStatus: statuses.rows.map(row => ({ status: row.status, count: Number(row.order_count) })),
      dailyGmv: daily.rows.map(row => ({ date: String(row.local_day).slice(0, 10), orderCount: Number(row.order_count), gmv: row.gmv })),
      topShops: shops.rows.map(row => ({ name: row.shop_name, orderCount: Number(row.order_count), gmv: row.gmv })),
      topProducts: products.rows.map(row => ({ name: row.product_name, quantitySold: Number(row.quantity_sold), gmv: row.gmv })),
      moderationActions: moderation.rows.map(row => ({ action: row.action, count: Number(row.count) })),
    };
  }

  async getDashboardStats() {
    const result = await this.pool.query<{
      total_users: string; total_shops: string; total_products: string; platform_gmv: string;
    }>(`SELECT
      (SELECT COUNT(*) FROM app_users)::text AS total_users,
      (SELECT COUNT(*) FROM shops)::text AS total_shops,
      (SELECT COUNT(*) FROM products)::text AS total_products,
      COALESCE((SELECT SUM(total_amount) FROM orders WHERE status='COMPLETED'), 0)::text AS platform_gmv`);
    const row = result.rows[0];
    return {
      totalUsers: Number(row?.total_users ?? 0),
      totalShops: Number(row?.total_shops ?? 0),
      totalProducts: Number(row?.total_products ?? 0),
      platformGMV: String(row?.platform_gmv ?? '0'),
    };
  }

  async listAuditLogs(input: { action?: string; target_type?: string; actor?: string; limit?: number } = {}) {
    const limit = input.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ValidationFailedError('limit must be from 1 to 100');
    const values: unknown[] = [];
    const where: string[] = [];
    for (const [column, value] of [['l.action', input.action], ['l.target_type', input.target_type], ['l.admin_id', input.actor]] as const) {
      if (value) { values.push(value); where.push(`${column}=$${values.length}`); }
    }
    values.push(limit);
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT l.log_id,l.action,l.target_type,l.target_id,l.reason,l.created_at,
              l.admin_id,u.email AS actor
         FROM admin_logs l JOIN app_users u ON u.user_id=l.admin_id
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY l.created_at DESC,l.log_id ASC LIMIT $${values.length}`,
      values,
    );
    return result.rows.map(row => ({
      id: String(row.log_id), action: String(row.action), targetType: row.target_type == null ? null : String(row.target_type),
      targetId: row.target_id == null ? null : String(row.target_id), reason: row.reason == null ? '' : String(row.reason),
      actor: String(row.actor), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    }));
  }
}
