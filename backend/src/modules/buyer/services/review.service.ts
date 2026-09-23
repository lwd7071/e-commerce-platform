import { randomUUID } from 'node:crypto';
import type { IReviewRepository } from '../domain/repositories';
import type { IOrderQueryPort } from '../ports/order-query.port';
import type { Review, UUID } from '../domain/types';
import {
  ValidationError,
  ReviewNotEligibleError,
} from '../domain/errors';
import { checkReviewEligibility } from '../domain/review';
import { validateCreateReviewDTO, type CreateReviewDTO } from '../contracts/buyer.dto';
import { ReviewMediaService } from './review-media.service';

/**
 * Service quản lý đánh giá sản phẩm (Review & ReviewImage).
 * Áp dụng:
 * - [QD14]: Chỉ người mua sở hữu đơn hàng COMPLETED mới được đánh giá.
 * - [RB-LQH05]: Review.ProductID phải trùng với OrderItem.ProductID.
 * - [RB-LB09 / QD15 / RB-MG08]: Mỗi OrderItem chỉ được đánh giá 1 lần, rating 1..5.
 * - [auth-rbac-rls.md §3 & §4]: Xác thực quyền sở hữu ảnh đánh giá qua ReviewMediaService.
 * - Dependency Inversion (D): Tách biệt qua IOrderQueryPort chính thức từ Người 5 và IReviewRepository.
 */
export class ReviewService {
  constructor(
    private readonly reviewRepo: IReviewRepository,
    private readonly orderQueryPort: IOrderQueryPort,
    private readonly reviewMediaService: ReviewMediaService = new ReviewMediaService()
  ) {}

  async createReview(
    buyerId: UUID,
    orderItemId: UUID,
    productId: UUID,
    rawInput: unknown
  ): Promise<Review> {
    const validated: CreateReviewDTO = validateCreateReviewDTO(rawInput);

    // 1. Lấy thông tin order item context từ IOrderQueryPort chính thức từ Người 5
    const orderItemContext = await this.orderQueryPort.getOrderItemForReview(orderItemId, buyerId);
    if (!orderItemContext) {
      throw new ReviewNotEligibleError('OrderItem không tồn tại hoặc không thể đánh giá (QD14).', {
        orderItemId,
      });
    }

    // 2. [RB-LQH05] Review.ProductID === OrderItem.ProductID
    if (orderItemContext.productId !== productId) {
      throw new ValidationError(
        'Sản phẩm đánh giá không khớp với sản phẩm trong đơn hàng (RB-LQH05).',
        {
          expectedProductId: orderItemContext.productId,
          actualProductId: productId,
        }
      );
    }

    // 3. Kiểm tra xem orderItemId này đã có review chưa
    const existingReview = await this.reviewRepo.findByOrderItemId(orderItemId);
    const hasExistingReview = !!existingReview;

    // 4. [QD14, RB-LB09] Kiểm tra điều kiện đánh giá (COMPLETED, buyer ownership, duplicate review)
    checkReviewEligibility(
      {
        orderItemId: orderItemContext.orderItemId,
        orderId: orderItemContext.orderId,
        productId: orderItemContext.productId,
        buyerId: orderItemContext.buyerId,
        orderStatus: orderItemContext.orderStatus,
        hasExistingReview,
      },
      buyerId
    );

    // 4.5. [auth-rbac-rls §4] Xác thực danh sách ảnh nếu có theo chuẩn Storage RLS
    const validatedImages = this.reviewMediaService.validateBuyerImages(
      buyerId,
      undefined,
      validated.images
    );

    // 5. Tạo review với trạng thái mặc định VISIBLE
    const now = new Date().toISOString();
    const newReview: Review = {
      reviewId: randomUUID(),
      buyerId,
      productId,
      orderItemId,
      rating: validated.rating,
      content: validated.content ?? null,
      status: 'VISIBLE',
      createdAt: now,
      updatedAt: now,
    };

    return this.reviewRepo.create(newReview, validatedImages);
  }

  async getReviewsByProduct(
    productId: UUID,
    limit = 20,
    cursor?: string
  ): Promise<{ reviews: Review[]; nextCursor?: string }> {
    const allReviews = await this.reviewRepo.findByProductId(productId);

    let startIndex = 0;
    if (cursor) {
      const idx = allReviews.findIndex(r => r.reviewId === cursor);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const reviews = allReviews.slice(startIndex, startIndex + limit);
    const nextCursor = reviews.length === limit ? reviews[reviews.length - 1].reviewId : undefined;

    return { reviews, nextCursor };
  }

  async getReviewByOrderItem(orderItemId: UUID): Promise<Review | null> {
    return this.reviewRepo.findByOrderItemId(orderItemId);
  }
}
