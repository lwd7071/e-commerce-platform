import type { OrderStatus } from '../domain/types.ts';
import type {
  IOrderRepository,
  OrderRecord,
  OrderItemRecord,
  UUID,
} from '../domain/repositories.ts';
import type { OrderStatusHistoryRecord } from '../domain/order-snapshot.ts';

export class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map<UUID, OrderRecord>();
  private orderItems = new Map<UUID, OrderItemRecord[]>();
  private statusHistory = new Map<UUID, OrderStatusHistoryRecord[]>();

  public async createOrder(
    order: OrderRecord,
    items: OrderItemRecord[],
    history: OrderStatusHistoryRecord,
  ): Promise<OrderRecord> {
    this.orders.set(order.orderId, { ...order });
    this.orderItems.set(order.orderId, items.map(i => ({ ...i })));
    this.statusHistory.set(order.orderId, [{ ...history }]);
    return this.orders.get(order.orderId)!;
  }

  public async findById(orderId: UUID): Promise<OrderRecord | null> {
    const order = this.orders.get(orderId);
    return order ? { ...order } : null;
  }

  public async findItemsByOrderId(orderId: UUID): Promise<OrderItemRecord[]> {
    const items = this.orderItems.get(orderId) || [];
    return items.map(i => ({ ...i }));
  }

  public async findItemById(orderItemId: UUID): Promise<OrderItemRecord | null> {
    for (const items of this.orderItems.values()) {
      const match = items.find(i => i.orderItemId === orderItemId);
      if (match) return { ...match };
    }
    return null;
  }

  public async findByBuyerId(buyerId: UUID): Promise<OrderRecord[]> {
    return Array.from(this.orders.values())
      .filter(o => o.buyerId === buyerId)
      .map(o => ({ ...o }));
  }

  public async findByShopId(shopId: UUID): Promise<OrderRecord[]> {
    return Array.from(this.orders.values())
      .filter(o => o.shopId === shopId)
      .map(o => ({ ...o }));
  }

  public async updateStatus(
    orderId: UUID,
    newStatus: OrderStatus,
    history: OrderStatusHistoryRecord,
  ): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) return;

    this.orders.set(orderId, {
      ...order,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });

    const existingHist = this.statusHistory.get(orderId) || [];
    existingHist.push({ ...history });
    this.statusHistory.set(orderId, existingHist);
  }

  public async findHistoryByOrderId(orderId: UUID): Promise<OrderStatusHistoryRecord[]> {
    const list = this.statusHistory.get(orderId) || [];
    return list.map(h => ({ ...h }));
  }

  public clear(): void {
    this.orders.clear();
    this.orderItems.clear();
    this.statusHistory.clear();
  }
}
