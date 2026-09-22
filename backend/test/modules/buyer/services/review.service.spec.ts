import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewService } from '../../../../src/modules/buyer/services/review.service';
import {
  ReviewNotEligibleError,
  ReviewAlreadyExistsError,
  ValidationError,
} from '../../../../src/modules/buyer/domain/errors';
import type { IReviewRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { IOrderQueryPort } from '../../../../src/modules/buyer/ports/order-query.port';
import type { Review, UUID } from '../../../../src/modules/buyer/domain/types';
import type { ReviewOrderItemContext } from '../../../../src/modules/buyer/domain/review';
import { mockBuyerId } from '../fixtures';

class MockReviewRepository implements IReviewRepository {
  public reviews: Map<UUID, Review> = new Map();
  public reviewImages: Map<UUID, string[]> = new Map();

  async findById(reviewId: UUID): Promise<Review | null> {
    return this.reviews.get(reviewId) ?? null;
  }

  async findByOrderItemId(orderItemId: UUID): Promise<Review | null> {
    for (const r of this.reviews.values()) {
      if (r.orderItemId === orderItemId) return r;
    }
    return null;
  }

  async findByProductId(productId: UUID): Promise<Review[]> {
    return Array.from(this.reviews.values()).filter(
      r => r.productId === productId && r.status === 'VISIBLE'
    );
  }

  async create(review: Review, images?: string[]): Promise<Review> {
    this.reviews.set(review.reviewId, review);
    if (images) {
      this.reviewImages.set(review.reviewId, images);
    }
    return review;
  }
}

class MockOrderQueryPort implements IOrderQueryPort {
  public contexts: Map<UUID, Omit<ReviewOrderItemContext, 'hasExistingReview'>> = new Map();

  setContext(orderItemId: UUID, context: Omit<ReviewOrderItemContext, 'hasExistingReview'>): void {
    this.contexts.set(orderItemId, context);
  }

  async getOrderItemContext(orderItemId: UUID): Promise<Omit<ReviewOrderItemContext, 'hasExistingReview'> | null> {
    return this.contexts.get(orderItemId) ?? null;
  }
}

describe('ReviewService Tests (TDD - Eligibility & Product Check)', () => {
  let reviewRepo: MockReviewRepository;
  let orderQueryPort: MockOrderQueryPort;
  let reviewService: ReviewService;

  const validOrderItemId = '11111111-1111-4111-8111-111111111111';
  const validOrderId = '22222222-2222-4222-8222-222222222222';
  const validProductId = '33333333-3333-4333-8333-333333333333';
  const otherBuyerId = '88888888-8888-4888-8888-888888888888';

  beforeEach(() => {
    reviewRepo = new MockReviewRepository();
    orderQueryPort = new MockOrderQueryPort();
    reviewService = new ReviewService(reviewRepo, orderQueryPort);

    // Context hợp lệ mặc định: đơn COMPLETED của mockBuyerId cho validProductId
    orderQueryPort.setContext(validOrderItemId, {
      orderItemId: validOrderItemId,
      orderId: validOrderId,
      productId: validProductId,
      buyerId: mockBuyerId,
      orderStatus: 'COMPLETED',
    });
  });

  describe('createReview', () => {
    it('tạo đánh giá thành công khi đủ điều kiện (đơn COMPLETED, đúng Buyer, đúng Product)', async () => {
      const review = await reviewService.createReview(
        mockBuyerId,
        validOrderItemId,
        validProductId,
        {
          rating: 5,
          content: 'Sản phẩm chất lượng tuyệt vời!',
          images: ['https://example.com/image1.jpg'],
        }
      );

      assert.equal(review.rating, 5);
      assert.equal(review.content, 'Sản phẩm chất lượng tuyệt vời!');
      assert.equal(review.status, 'VISIBLE');
      assert.equal(review.productId, validProductId);
      assert.equal(review.buyerId, mockBuyerId);

      const savedImages = reviewRepo.reviewImages.get(review.reviewId);
      assert.deepEqual(savedImages, ['https://example.com/image1.jpg']);
    });

    it('[QD14] ném REVIEW_NOT_ELIGIBLE khi orderItem không tồn tại trên hệ thống Order', async () => {
      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          '99999999-9999-4999-8999-999999999999',
          validProductId,
          { rating: 5 }
        ),
        (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[QD14] ném REVIEW_NOT_ELIGIBLE khi người yêu cầu không phải Buyer sở hữu đơn hàng', async () => {
      await assert.rejects(
        async () => reviewService.createReview(
          otherBuyerId, // Sai buyer
          validOrderItemId,
          validProductId,
          { rating: 5 }
        ),
        (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[QD14] ném REVIEW_NOT_ELIGIBLE khi trạng thái đơn hàng chưa phải là COMPLETED', async () => {
      // Giả lập đơn hàng đang SHIPPED
      orderQueryPort.setContext(validOrderItemId, {
        orderItemId: validOrderItemId,
        orderId: validOrderId,
        productId: validProductId,
        buyerId: mockBuyerId,
        orderStatus: 'SHIPPED',
      });

      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          validOrderItemId,
          validProductId,
          { rating: 5 }
        ),
        (err: unknown) => err instanceof ReviewNotEligibleError && err.code === 'REVIEW_NOT_ELIGIBLE'
      );
    });

    it('[RB-LQH05] ném VALIDATION_FAILED khi productId đánh giá không khớp với productId của OrderItem', async () => {
      const wrongProductId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          validOrderItemId,
          wrongProductId,
          { rating: 5 }
        ),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-LB09 / QD15] ném REVIEW_ALREADY_EXISTS khi OrderItem đã được đánh giá trước đó', async () => {
      // Đánh giá lần 1
      await reviewService.createReview(
        mockBuyerId,
        validOrderItemId,
        validProductId,
        { rating: 5, content: 'Đánh giá lần đầu' }
      );

      // Đánh giá lần 2 trên cùng orderItemId
      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          validOrderItemId,
          validProductId,
          { rating: 4, content: 'Đánh giá lần 2' }
        ),
        (err: unknown) => err instanceof ReviewAlreadyExistsError && err.code === 'REVIEW_ALREADY_EXISTS'
      );
    });

    it('[QD15 / RB-MG08] ném VALIDATION_FAILED khi rating nằm ngoài khoảng 1..5', async () => {
      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          validOrderItemId,
          validProductId,
          { rating: 6 }
        ),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );

      await assert.rejects(
        async () => reviewService.createReview(
          mockBuyerId,
          validOrderItemId,
          validProductId,
          { rating: 0 }
        ),
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('getReviewsByProduct', () => {
    it('lấy danh sách review hiển thị (status VISIBLE) theo productId có phân trang', async () => {
      await reviewService.createReview(
        mockBuyerId,
        validOrderItemId,
        validProductId,
        { rating: 5, content: 'Review 1' }
      );

      const result = await reviewService.getReviewsByProduct(validProductId, 10);
      assert.equal(result.reviews.length, 1);
      assert.equal(result.reviews[0].content, 'Review 1');
    });
  });

  describe('getReviewByOrderItem', () => {
    it('lấy review theo orderItemId', async () => {
      await reviewService.createReview(
        mockBuyerId,
        validOrderItemId,
        validProductId,
        { rating: 4, content: 'Đánh giá test' }
      );

      const found = await reviewService.getReviewByOrderItem(validOrderItemId);
      assert.ok(found);
      assert.equal(found.orderItemId, validOrderItemId);
      assert.equal(found.rating, 4);
    });

    it('trả về null nếu orderItemId chưa được đánh giá', async () => {
      const found = await reviewService.getReviewByOrderItem('99999999-9999-4999-8999-999999999999');
      assert.equal(found, null);
    });
  });
});
