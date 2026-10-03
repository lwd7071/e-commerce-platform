import type { OrderStatus } from '../domain/types.ts';

export type UUID = string;

export interface ReviewOrderItemDTO {
  readonly orderItemId: UUID;
  readonly orderId: UUID;
  readonly productId: UUID;
  readonly buyerId: UUID;
  readonly orderStatus: OrderStatus;
  readonly hasExistingReview?: boolean;
}

export interface OrderSummaryDTO {
  readonly orderId: UUID;
  readonly buyerId: UUID;
  readonly shopId: UUID;
  readonly status: OrderStatus;
  readonly subtotal: string;
  readonly discountAmount: string;
  readonly shippingFee: string;
  readonly totalAmount: string;
  readonly createdAt: string;
}

export interface IOrderQueryPort {
  /**
   * Retrieves order item context needed for Member 4's review eligibility check (QD14).
   * Verifies buyer ownership and completed status.
   */
  getOrderItemForReview(orderItemId: UUID, buyerId: UUID): Promise<ReviewOrderItemDTO | null>;

  /**
   * Retrieves order summary by order ID.
   */
  getOrderSummary(orderId: UUID): Promise<OrderSummaryDTO | null>;
}
