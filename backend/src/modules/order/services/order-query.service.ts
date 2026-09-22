import type { UUID, IOrderRepository } from '../domain/repositories.ts';
import type {
  IOrderQueryPort,
  ReviewOrderItemDTO,
  OrderSummaryDTO,
} from '../contracts/order-query.contract.ts';

export class OrderQueryService implements IOrderQueryPort {
  private orderRepo: IOrderRepository;

  constructor(orderRepo: IOrderRepository) {
    this.orderRepo = orderRepo;
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
