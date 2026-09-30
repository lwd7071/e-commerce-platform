import type { UUID, IOrderRepository } from '../domain/repositories.ts';
import type { Pool } from 'pg';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import { DependencyUnavailableError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import type { OrderStatus } from '../domain/types.ts';
import type {
  IOrderQueryPort,
  ReviewOrderItemDTO,
  OrderSummaryDTO,
} from '../contracts/order-query.contract.ts';

export class OrderQueryService implements IOrderQueryPort {
  private orderRepo: IOrderRepository;
  private readonly pool?: Pool;

  constructor(orderRepo: IOrderRepository, pool?: Pool) {
    this.orderRepo = orderRepo;
    this.pool = pool;
  }

  async listOrders(viewer: RequestContext, filter: { status?: string } = {}): Promise<OrderReadDTO[]> {
    return this.fetchOrderReads(viewer, filter.status);
  }

  async getOrderDetail(viewer: RequestContext, orderId: UUID): Promise<OrderReadDTO | null> {
    const rows = await this.fetchOrderReads(viewer, undefined, orderId);
    return rows[0] ?? null;
  }

  private async fetchOrderReads(viewer: RequestContext, rawStatus?: string, orderId?: UUID): Promise<OrderReadDTO[]> {
    if (!this.pool) throw new DependencyUnavailableError('Order query database is not configured');
    const statuses: readonly string[] = ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'];
    if (rawStatus !== undefined && !statuses.includes(rawStatus)) {
      throw new ValidationFailedError('Invalid order status filter', { field: 'status' });
    }
    const values: unknown[] = [];
    const where: string[] = [];
    if (viewer.role === 'BUYER') {
      values.push(viewer.user_id);
      where.push(`o.buyer_id=$${values.length}`);
    } else if (viewer.role === 'SELLER') {
      if (!viewer.shop_id) return [];
      values.push(viewer.shop_id);
      where.push(`o.shop_id=$${values.length}`);
    }
    if (rawStatus) {
      values.push(rawStatus);
      where.push(`o.status=$${values.length}`);
    }
    if (orderId) {
      values.push(orderId);
      where.push(`o.order_id=$${values.length}`);
    }
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT o.order_id,o.buyer_id,o.shop_id,s.shop_name,o.status,o.subtotal,o.discount_amount,o.shipping_fee,
              o.total_amount,o.cancel_reason,o.created_at,o.updated_at
       FROM orders o JOIN shops s ON s.shop_id=o.shop_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY o.created_at DESC,o.order_id DESC`, values,
    );
    if (result.rows.length === 0) return [];
    const ids = result.rows.map(row => String(row.order_id));
    const itemRows = await this.pool.query<Record<string, unknown>>(
      `SELECT oi.order_item_id,oi.order_id,oi.product_id,oi.variant_id,oi.product_name_snapshot,oi.variant_snapshot,
              oi.unit_price,oi.quantity,oi.line_total,primary_image.image_url
       FROM order_items oi
       LEFT JOIN LATERAL (
         SELECT image_url FROM product_images pi WHERE pi.product_id=oi.product_id ORDER BY pi.sort_order,pi.image_id LIMIT 1
       ) primary_image ON TRUE
       WHERE oi.order_id=ANY($1::uuid[])
       ORDER BY oi.order_id,oi.order_item_id`, [ids],
    );
    const grouped = new Map<string, OrderReadDTO['items']>();
    for (const item of itemRows.rows) {
      const orderKey = String(item.order_id);
      const items = grouped.get(orderKey) ?? [];
      items.push({
        order_item_id: String(item.order_item_id), product_id: String(item.product_id), variant_id: String(item.variant_id),
        product_name: String(item.product_name_snapshot), variant_name: item.variant_snapshot == null ? '' : String(item.variant_snapshot),
        unit_price: String(item.unit_price), quantity: Number(item.quantity), line_total: String(item.line_total),
        image_url: item.image_url == null ? null : String(item.image_url),
      });
      grouped.set(orderKey, items);
    }
    return result.rows.map(row => ({
      order_id: String(row.order_id), buyer_id: String(row.buyer_id), shop_id: String(row.shop_id), shop_name: String(row.shop_name),
      status: row.status as OrderStatus, subtotal: String(row.subtotal), discount_amount: String(row.discount_amount),
      shipping_fee: String(row.shipping_fee), total_amount: String(row.total_amount),
      cancel_reason: row.cancel_reason == null ? null : String(row.cancel_reason),
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
      items: grouped.get(String(row.order_id)) ?? [],
    }));
  }

  public async getOrderItemForReview(orderItemId: UUID, buyerId: UUID): Promise<ReviewOrderItemDTO | null> {
    const item = await this.orderRepo.findItemById(orderItemId);
    if (!item) {
      return null;
    }

    const order = await this.orderRepo.findById(item.orderId);
    if (!order) {
      return null;
    }

    // Verify ownership
    if (order.buyerId !== buyerId) {
      return null;
    }

    return {
      orderItemId: item.orderItemId,
      orderId: order.orderId,
      productId: item.productId,
      buyerId: order.buyerId,
      orderStatus: order.status,
      hasExistingReview: false,
    };
  }

  public async getOrderSummary(orderId: UUID): Promise<OrderSummaryDTO | null> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) return null;

    return {
      orderId: order.orderId,
      buyerId: order.buyerId,
      shopId: order.shopId,
      status: order.status,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      shippingFee: order.shippingFee,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    };
  }
}

export interface OrderReadDTO {
  order_id: string;
  buyer_id: string;
  shop_id: string;
  shop_name: string;
  status: OrderStatus;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  total_amount: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    order_item_id: string;
    product_id: string;
    variant_id: string;
    product_name: string;
    variant_name: string;
    unit_price: string;
    quantity: number;
    line_total: string;
    image_url: string | null;
  }>;
}
