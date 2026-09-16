import { ValidationError, ReviewNotEligibleError, ReviewAlreadyExistsError } from './errors.ts';
import type { UUID } from './types.ts';

/**
 * [QD15, RB-MG08] Review.Rating thuộc {1, 2, 3, 4, 5} (số nguyên)
 */
export function validateReviewRating(rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ValidationError('Điểm đánh giá phải là số nguyên từ 1 đến 5 (QD15, RB-MG08).', {
      rating,
    });
  }
}

export interface ReviewOrderItemContext {
  orderItemId: UUID;
  orderId: UUID;
  productId: UUID;
  buyerId: UUID;
  orderStatus: string;
  hasExistingReview?: boolean;
}

/**
 * [QD14, RB-LB09, RB-LQH05]
 * - QD14: Chỉ người mua sở hữu đơn hàng COMPLETED mới được đánh giá OrderItem
 * - RB-LB09: Mỗi OrderItem chỉ được đánh giá tối đa 1 lần (Review.OrderItemID UNIQUE)
 */
export function checkReviewEligibility(orderItemContext: ReviewOrderItemContext, requesterBuyerId: UUID): void {
  // 1. [QD14] Kiểm tra quyền sở hữu Buyer
  if (orderItemContext.buyerId !== requesterBuyerId) {
    throw new ReviewNotEligibleError('Bạn không phải là người mua của đơn hàng này (QD14).', {
      orderBuyerId: orderItemContext.buyerId,
      requesterBuyerId,
    });
  }

  // 2. [QD14] Kiểm tra trạng thái đơn phải là COMPLETED
  if (orderItemContext.orderStatus !== 'COMPLETED') {
    throw new ReviewNotEligibleError('Chỉ có thể đánh giá sản phẩm khi đơn hàng đã ở trạng thái COMPLETED (QD14).', {
      currentStatus: orderItemContext.orderStatus,
    });
  }

  // 3. [RB-LB09] Mỗi OrderItem chỉ được đánh giá tối đa 1 lần
  if (orderItemContext.hasExistingReview === true) {
    throw new ReviewAlreadyExistsError('Sản phẩm trong đơn hàng này đã được đánh giá trước đó (RB-LB09).', {
      orderItemId: orderItemContext.orderItemId,
    });
  }
}
