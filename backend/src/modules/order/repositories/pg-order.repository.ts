import type { Pool, PoolClient } from 'pg';
import type { OrderStatus } from '../domain/types.ts';
import type {
  IOrderRepository,
  OrderRecord,
  OrderItemRecord,
  UUID,
} from '../domain/repositories.ts';
import type { OrderStatusHistoryRecord } from '../domain/order-snapshot.ts';

type DatabaseRow = Record<string, unknown>;
const isoString = (value: unknown): string => value instanceof Date ? value.toISOString() : String(value);

export const mapOrderRow = (row: DatabaseRow): OrderRecord => ({
  orderId: String(row.order_id),
  buyerId: String(row.buyer_id),
  shopId: String(row.shop_id),
  recipientName: String(row.recipient_name),
  recipientPhone: String(row.recipient_phone),
  province: String(row.province),
  district: String(row.district),
  ward: String(row.ward),
  deliveryAddress: String(row.delivery_address),
  subtotal: typeof row.subtotal === 'string' ? row.subtotal : Number(row.subtotal).toFixed(2),
  discountAmount: typeof row.discount_amount === 'string' ? row.discount_amount : Number(row.discount_amount).toFixed(2),
  shippingFee: typeof row.shipping_fee === 'string' ? row.shipping_fee : Number(row.shipping_fee).toFixed(2),
  totalAmount: typeof row.total_amount === 'string' ? row.total_amount : Number(row.total_amount).toFixed(2),
  status: row.status as OrderStatus,
  cancelReason: row.cancel_reason == null ? null : String(row.cancel_reason),
  createdAt: isoString(row.created_at),
  updatedAt: isoString(row.updated_at),
});

export const mapOrderItemRow = (row: DatabaseRow): OrderItemRecord => ({
  orderItemId: String(row.order_item_id),
  orderId: String(row.order_id),
  productId: String(row.product_id),
  variantId: String(row.variant_id),
  productNameSnapshot: String(row.product_name_snapshot),
  variantSnapshot: String(row.variant_snapshot),
  unitPrice: typeof row.unit_price === 'string' ? row.unit_price : Number(row.unit_price).toFixed(2),
  quantity: Number(row.quantity),
  lineTotal: typeof row.line_total === 'string' ? row.line_total : Number(row.line_total).toFixed(2),
});

export const mapStatusHistoryRow = (row: DatabaseRow): OrderStatusHistoryRecord => ({
  historyId: String(row.history_id),
  orderId: String(row.order_id),
  oldStatus: row.old_status as OrderStatus | null,
  newStatus: row.new_status as OrderStatus,
  changedBy: row.changed_by == null ? null : String(row.changed_by),
  reason: row.reason == null ? null : String(row.reason),
  changedAt: isoString(row.changed_at),
});

export class PgOrderRepository implements IOrderRepository {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private getExecutor(client?: PoolClient): Pool | PoolClient {
    return client ?? this.pool;
  }

  public async createOrder(
    order: OrderRecord,
    items: OrderItemRecord[],
    history: OrderStatusHistoryRecord,
    client?: PoolClient,
  ): Promise<OrderRecord> {
    const executor = this.getExecutor(client);

    // 1. Insert order
    const orderSql = `
      INSERT INTO orders (
        order_id, buyer_id, shop_id, recipient_name, recipient_phone,
        province, district, ward, delivery_address,
        subtotal, discount_amount, shipping_fee, total_amount,
        status, cancel_reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *;
    `;
    const orderParams = [
      order.orderId,
      order.buyerId,
      order.shopId,
      order.recipientName,
      order.recipientPhone,
      order.province,
      order.district,
      order.ward,
      order.deliveryAddress,
      order.subtotal,
      order.discountAmount,
      order.shippingFee,
      order.totalAmount,
      order.status,
      order.cancelReason || null,
      order.createdAt,
      order.updatedAt,
    ];
    const orderResult = await executor.query(orderSql, orderParams);

    // 2. Insert order items
    const itemSql = `
      INSERT INTO order_items (
        order_item_id, order_id, product_id, variant_id,
        product_name_snapshot, variant_snapshot, unit_price, quantity, line_total
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `;
    for (const item of items) {
      await executor.query(itemSql, [
        item.orderItemId,
        item.orderId,
        item.productId,
        item.variantId,
        item.productNameSnapshot,
        item.variantSnapshot,
        item.unitPrice,
        item.quantity,
        item.lineTotal,
      ]);
    }

    // 3. Insert initial order_status_history
    const historySql = `
      INSERT INTO order_status_history (
        history_id, order_id, old_status, new_status, changed_by, reason, changed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;
    await executor.query(historySql, [
      history.historyId,
      history.orderId,
      history.oldStatus || null,
      history.newStatus,
      history.changedBy || null,
      history.reason || null,
      history.changedAt,
    ]);

    return mapOrderRow(orderResult.rows[0]);
  }

  public async findById(orderId: UUID, client?: PoolClient): Promise<OrderRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query('SELECT * FROM orders WHERE order_id = $1;', [orderId]);
    if (result.rows.length === 0) return null;
    return mapOrderRow(result.rows[0]);
  }

  public async findItemsByOrderId(orderId: UUID, client?: PoolClient): Promise<OrderItemRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY order_item_id;',
      [orderId],
    );
    return result.rows.map(mapOrderItemRow);
  }

  public async findItemById(orderItemId: UUID, client?: PoolClient): Promise<OrderItemRecord | null> {
    const executor = this.getExecutor(client);
    const result = await executor.query('SELECT * FROM order_items WHERE order_item_id = $1;', [orderItemId]);
    if (result.rows.length === 0) return null;
    return mapOrderItemRow(result.rows[0]);
  }

  public async findByBuyerId(buyerId: UUID, client?: PoolClient): Promise<OrderRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC;',
      [buyerId],
    );
    return result.rows.map(mapOrderRow);
  }

  public async findByShopId(shopId: UUID, client?: PoolClient): Promise<OrderRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'SELECT * FROM orders WHERE shop_id = $1 ORDER BY created_at DESC;',
      [shopId],
    );
    return result.rows.map(mapOrderRow);
  }

  public async updateStatus(
    orderId: UUID,
    newStatus: OrderStatus,
    history: OrderStatusHistoryRecord,
    client?: PoolClient,
  ): Promise<void> {
    const executor = this.getExecutor(client);
    await executor.query(
      'UPDATE orders SET status = $1, updated_at = now() WHERE order_id = $2;',
      [newStatus, orderId],
    );

    const historySql = `
      INSERT INTO order_status_history (
        history_id, order_id, old_status, new_status, changed_by, reason, changed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;
    await executor.query(historySql, [
      history.historyId,
      history.orderId,
      history.oldStatus || null,
      history.newStatus,
      history.changedBy || null,
      history.reason || null,
      history.changedAt,
    ]);
  }

  public async findHistoryByOrderId(orderId: UUID, client?: PoolClient): Promise<OrderStatusHistoryRecord[]> {
    const executor = this.getExecutor(client);
    const result = await executor.query(
      'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at ASC;',
      [orderId],
    );
    return result.rows.map(mapStatusHistoryRow);
  }
}
