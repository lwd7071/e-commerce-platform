import type { Pool, QueryResultRow } from 'pg';
import type {
  FlashSaleSession,
  FlashSaleItem,
  CompensationStatus,
} from '../domain/flash-sale.types.ts';

type FlashSaleSessionRow = QueryResultRow & Pick<FlashSaleSession, 'slot_id' | 'slot_name' | 'status'> & {
  start_time: Date | string;
  end_time: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
};

type FlashSaleItemRow = QueryResultRow & Pick<FlashSaleItem,
  'item_id' | 'slot_id' | 'product_id' | 'variant_id' | 'allocated_stock'
> & {
  original_price: string | number;
  flash_sale_price: string | number;
  created_at: Date | string;
  updated_at: Date | string;
};

export class PgFlashSaleRepository {
  constructor(private readonly pool: Pool) {}

  async listActiveSessions(): Promise<FlashSaleSession[]> {
    const res = await this.pool.query<FlashSaleSessionRow>(
      `SELECT slot_id, slot_name, start_time, end_time, status, created_at, updated_at
       FROM flash_sale_sessions
       WHERE status IN ('UPCOMING', 'ACTIVE')
       ORDER BY start_time ASC`
    );
    return res.rows.map(this.mapSession);
  }

  async findSessionById(slotId: string): Promise<FlashSaleSession | null> {
    const res = await this.pool.query<FlashSaleSessionRow>(
      `SELECT slot_id, slot_name, start_time, end_time, status, created_at, updated_at
       FROM flash_sale_sessions
       WHERE slot_id = $1`,
      [slotId]
    );
    return res.rows[0] ? this.mapSession(res.rows[0]) : null;
  }

  async listItemsBySlotId(slotId: string): Promise<FlashSaleItem[]> {
    const res = await this.pool.query<FlashSaleItemRow>(
      `SELECT item_id, slot_id, product_id, variant_id, original_price::text, flash_sale_price::text, allocated_stock, created_at, updated_at
       FROM flash_sale_items
       WHERE slot_id = $1
       ORDER BY created_at ASC`,
      [slotId]
    );
    return res.rows.map(this.mapItem);
  }

  async findItemById(itemId: string): Promise<FlashSaleItem | null> {
    const res = await this.pool.query<FlashSaleItemRow>(
      `SELECT item_id, slot_id, product_id, variant_id, original_price::text, flash_sale_price::text, allocated_stock, created_at, updated_at
       FROM flash_sale_items
       WHERE item_id = $1`,
      [itemId]
    );
    return res.rows[0] ? this.mapItem(res.rows[0]) : null;
  }

  async findOrderIdByIdempotencyKey(idempKey: string): Promise<string | null> {
    // Check in api_idempotency_records or orders cancel_reason / note
    const res = await this.pool.query(
      `SELECT result->>'order_id' as order_id
       FROM api_idempotency_records
       WHERE idempotency_key = $1
       LIMIT 1`,
      [idempKey]
    );
    if (res.rows[0]?.order_id) {
      return res.rows[0].order_id;
    }

    const orderRes = await this.pool.query(
      `SELECT order_id FROM orders WHERE cancel_reason = $1 OR order_id::text = $1 LIMIT 1`,
      [idempKey]
    );
    return orderRes.rows[0]?.order_id ?? null;
  }

  async insertCompensationLog(log: {
    compensation_id: string;
    slot_id: string;
    item_id: string;
    user_id: string;
    reason: string;
    status: CompensationStatus;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO flash_sale_compensation_logs (compensation_id, slot_id, item_id, user_id, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (compensation_id) DO NOTHING`,
      [log.compensation_id, log.slot_id, log.item_id, log.user_id, log.reason, log.status]
    );
  }

  async updateCompensationLogStatus(compensationId: string, status: CompensationStatus): Promise<void> {
    await this.pool.query(
      `UPDATE flash_sale_compensation_logs
       SET status = $1, updated_at = now()
       WHERE compensation_id = $2`,
      [status, compensationId]
    );
  }

  async getReconciliationCounts(slotId: string): Promise<{ validOrders: number; appliedCompensations: number }> {
    const ordersRes = await this.pool.query(
      `SELECT COUNT(*)::int as count
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN flash_sale_items fsi ON oi.variant_id = fsi.variant_id
       WHERE fsi.slot_id = $1 AND o.status NOT IN ('CANCELLED', 'REFUNDED')`,
      [slotId]
    );

    const compRes = await this.pool.query(
      `SELECT COUNT(*)::int as count
       FROM flash_sale_compensation_logs
       WHERE slot_id = $1 AND status = 'APPLIED'`,
      [slotId]
    );

    return {
      validOrders: ordersRes.rows[0]?.count ?? 0,
      appliedCompensations: compRes.rows[0]?.count ?? 0,
    };
  }

  async countValidOrdersForItem(slotId: string, itemId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int as count
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN flash_sale_items fsi ON oi.variant_id = fsi.variant_id
       WHERE fsi.slot_id = $1 AND fsi.item_id = $2
         AND o.status NOT IN ('CANCELLED', 'REFUNDED')`,
      [slotId, itemId]
    );
    return res.rows[0]?.count ?? 0;
  }

  async getUnifiedItemOrderSnapshot(
    slotId: string,
    startTime: string,
    endTime: string
  ): Promise<Array<{ item_id: string; allocated_stock: number; valid_orders_count: number }>> {
    const res = await this.pool.query(
      `SELECT 
         fsi.item_id,
         fsi.allocated_stock,
         COALESCE(COUNT(o.order_id) FILTER (
           WHERE o.status NOT IN ('CANCELLED', 'REFUNDED')
             AND o.created_at >= $2::timestamptz 
             AND o.created_at <= $3::timestamptz
         ), 0)::int as valid_orders_count
       FROM flash_sale_items fsi
       LEFT JOIN order_items oi ON fsi.variant_id = oi.variant_id
       LEFT JOIN orders o ON oi.order_id = o.order_id
       WHERE fsi.slot_id = $1
       GROUP BY fsi.item_id, fsi.allocated_stock
       ORDER BY fsi.item_id ASC`,
      [slotId, startTime, endTime]
    );
    return res.rows.map((r) => ({
      item_id: String(r.item_id),
      allocated_stock: Number(r.allocated_stock),
      valid_orders_count: Number(r.valid_orders_count),
    }));
  }

  async listRecentlyEndedSessions(withinMinutes: number, limit: number): Promise<FlashSaleSession[]> {
    const res = await this.pool.query<FlashSaleSessionRow>(
      `SELECT slot_id, slot_name, start_time, end_time, status, created_at, updated_at
       FROM flash_sale_sessions
       WHERE status = 'ENDED'
         AND end_time >= NOW() - ($1 * interval '1 minute')
       ORDER BY end_time DESC
       LIMIT $2`,
      [withinMinutes, limit]
    );
    return res.rows.map(this.mapSession);
  }

  async getLatestCompensationLog(slotId: string): Promise<QueryResultRow | null> {
    const res = await this.pool.query(
      `SELECT compensation_id, slot_id, item_id, user_id, reason, status, created_at, updated_at
       FROM flash_sale_compensation_logs
       WHERE slot_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [slotId]
    );
    return res.rows[0] ?? null;
  }

  private mapSession(row: FlashSaleSessionRow): FlashSaleSession {
    const toIso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
    return {
      slot_id: row.slot_id,
      slot_name: row.slot_name,
      start_time: toIso(row.start_time),
      end_time: toIso(row.end_time),
      status: row.status,
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }

  private mapItem(row: FlashSaleItemRow): FlashSaleItem {
    const toIso = (value: Date | string) => value instanceof Date ? value.toISOString() : value;
    return {
      item_id: row.item_id,
      slot_id: row.slot_id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      original_price: String(row.original_price),
      flash_sale_price: String(row.flash_sale_price),
      allocated_stock: Number(row.allocated_stock),
      created_at: toIso(row.created_at),
      updated_at: toIso(row.updated_at),
    };
  }
}
