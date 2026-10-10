import type { OrderStatus } from './types.ts';
import type { OrderItemSnapshot, OrderAddressSnapshot, OrderStatusHistoryRecord } from './order-snapshot.ts';
import type { DatabaseExecutor } from '../../../../db/types.ts';

export type UUID = string;
export type DecimalString = string;

export interface OrderRecord extends OrderAddressSnapshot {
  readonly orderId: UUID;
  readonly buyerId: UUID;
  readonly shopId: UUID;
  readonly subtotal: DecimalString;
  readonly discountAmount: DecimalString;
  readonly shippingFee: DecimalString;
  readonly totalAmount: DecimalString;
  readonly status: OrderStatus;
  readonly cancelReason?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type OrderItemRecord = OrderItemSnapshot;

export interface IOrderRepository {
  /**
   * Persists an order, its items, and its initial status history atomically.
   */
  createOrder(
    order: OrderRecord,
    items: OrderItemRecord[],
    history: OrderStatusHistoryRecord,
    client?: DatabaseExecutor,
  ): Promise<OrderRecord>;

  /**
   * Finds an order by its ID.
   */
  findById(orderId: UUID, client?: DatabaseExecutor): Promise<OrderRecord | null>;

  /**
   * Finds all items belonging to an order.
   */
  findItemsByOrderId(orderId: UUID, client?: DatabaseExecutor): Promise<OrderItemRecord[]>;

  /**
   * Finds a specific order item by its ID.
   */
  findItemById(orderItemId: UUID, client?: DatabaseExecutor): Promise<OrderItemRecord | null>;

  /**
   * Finds all orders belonging to a buyer.
   */
  findByBuyerId(buyerId: UUID, client?: DatabaseExecutor): Promise<OrderRecord[]>;

  /**
   * Finds all orders belonging to a shop.
   */
  findByShopId(shopId: UUID, client?: DatabaseExecutor): Promise<OrderRecord[]>;

  /**
   * Updates an order's status and adds an entry to order_status_history.
   */
  updateStatus(
    orderId: UUID,
    newStatus: OrderStatus,
    history: OrderStatusHistoryRecord,
    client?: DatabaseExecutor,
  ): Promise<void>;

  /**
   * Finds the status history for an order in chronological order.
   */
  findHistoryByOrderId(orderId: UUID, client?: DatabaseExecutor): Promise<OrderStatusHistoryRecord[]>;
}
