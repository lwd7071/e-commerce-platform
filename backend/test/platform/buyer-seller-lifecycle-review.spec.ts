import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { RequestHandler } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { ReviewService } from '../../src/modules/buyer/services/review.service.ts';
import type { IReviewRepository } from '../../src/modules/buyer/domain/repositories.ts';
import type { IOrderQueryPort, ReviewOrderItemDTO } from '../../src/modules/buyer/ports/order-query.port.ts';
import type { Review } from '../../src/modules/buyer/domain/types.ts';
import type { OrderStatus } from '../../src/modules/order/domain/types.ts';

describe('Buyer Review Route Flow Integration (QD14 Guard, Presigned Media ID Linkage, RB-LB09 Duplicate Blocking & Public Catalog)', () => {
  const buyerId = '11111111-1111-4111-8111-111111111111';
  const sellerId = '22222222-2222-4222-8222-222222222222';
  const shopId = '33333333-3333-4333-8333-333333333333';
  const orderId = '44444444-4444-4444-8444-444444444444';
  const orderItemId = '55555555-5555-4555-8555-555555555555';
  const productId = '66666666-6666-4666-8666-666666666666';
  const reviewId = '77777777-7777-4777-8777-777777777777';
  let presignedMediaId = '';

  let currentOrderStatus: OrderStatus = 'PENDING_CONFIRMATION';

  const mockOrderQueryPort: IOrderQueryPort = {
    getOrderItemForReview: async (itemQueryId: string, bId: string): Promise<ReviewOrderItemDTO | null> => {
      if (itemQueryId !== orderItemId || bId !== buyerId) return null;
      return {
        orderItemId,
        orderId,
        productId,
        buyerId,
        orderStatus: currentOrderStatus,
      };
    },
    getOrderSummary: async () => null,
  };

  class InMemoryReviewRepo implements IReviewRepository {
    public reviews: Review[] = [];
    public attachedMedia: Map<string, string[]> = new Map();

    async findById(id: string): Promise<Review | null> {
      return this.reviews.find(r => r.reviewId === id) ?? null;
    }

    async findByOrderItemId(oiId: string): Promise<Review | null> {
      return this.reviews.find(r => r.orderItemId === oiId) ?? null;
    }

    async findByProductId(pId: string): Promise<Review[]> {
      return this.reviews.filter(r => r.productId === pId && r.status === 'VISIBLE');
    }

    async create(review: Review, images?: string[], mediaIds?: string[]): Promise<Review> {
      this.reviews.push(review);
      if (mediaIds && mediaIds.length > 0) {
        this.attachedMedia.set(review.reviewId, mediaIds);
      }
      return review;
    }
  }

  const reviewRepo = new InMemoryReviewRepo();
  const reviewService = new ReviewService(reviewRepo, mockOrderQueryPort);

  let activeRole: 'BUYER' | 'SELLER' = 'BUYER';
  const authMiddleware: RequestHandler = (req, _res, next) => {
    req.context = createRequestContext({
      request_id: 'req_lifecycle',
      user_id: activeRole === 'BUYER' ? buyerId : sellerId,
      role: activeRole,
      shop_id: activeRole === 'SELLER' ? shopId : undefined,
      shop_status: activeRole === 'SELLER' ? 'ACTIVE' : undefined,
    });
    next();
  };

  const app = createApp({
    auth: authMiddleware,
    buyerServices: { reviewService },
  });

  it('Step 1: Buyer cannot review while order is not completed (QD14 Guard)', async () => {
    activeRole = 'BUYER';
    currentOrderStatus = 'PENDING_CONFIRMATION';

    const res = await request(app)
      .post(`/api/v1/order-items/${orderItemId}/review`)
      .send({
        product_id: productId,
        rating: 5,
        content: 'Chưa giao mà đã nhận xét',
      });

    assert.strictEqual(res.status, 422);
    assert.strictEqual(res.body.error.code, 'REVIEW_NOT_ELIGIBLE');
  });

  it('Step 2: Order transitions to COMPLETED in order query port context', () => {
    currentOrderStatus = 'COMPLETED';
    assert.strictEqual(currentOrderStatus, 'COMPLETED');
  });

  it('Step 3: Buyer requests presigned URL for review photo and receives mediaId', async () => {
    activeRole = 'BUYER';

    const res = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'real_product_photo.jpg',
        purpose: 'review_image',
        content_type: 'image/jpeg',
        review_id: reviewId,
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.data.upload_url);
    assert.ok(res.body.data.media_id);
    presignedMediaId = res.body.data.media_id;
    assert.strictEqual(
      res.body.data.storage_path,
      `users/${buyerId}/reviews/${reviewId}/${presignedMediaId}.jpg`,
    );
  });

  it('Step 4: Buyer submits review with rating, content, and the exact presigned mediaId', async () => {
    activeRole = 'BUYER';
    assert.ok(presignedMediaId, 'presignedMediaId must be captured from Step 3');

    const res = await request(app)
      .post(`/api/v1/order-items/${orderItemId}/review`)
      .send({
        product_id: productId,
        rating: 5,
        content: 'Hàng nhận rất ưng ý, chất vải mềm mịn và đóng gói cẩn thận!',
        review_id: reviewId,
        image_media_ids: [presignedMediaId],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.review_id, reviewId);
    assert.strictEqual(res.body.data.rating, 5);
    assert.strictEqual(reviewRepo.attachedMedia.get(reviewId)?.[0], presignedMediaId);
  });

  it('Step 5: Duplicate review on the same order item is blocked (RB-LB09)', async () => {
    activeRole = 'BUYER';

    const res = await request(app)
      .post(`/api/v1/order-items/${orderItemId}/review`)
      .send({
        product_id: productId,
        rating: 4,
        content: 'Cố tình đánh giá lần thứ 2',
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error.code, 'REVIEW_ALREADY_EXISTS');
  });

  it('Step 6: Public review catalog displays the verified review and rating summary', async () => {
    const res = await request(app)
      .get(`/api/v1/products/${productId}/reviews`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.length, 1);
    assert.strictEqual(res.body.data[0].review_id, reviewId);
    assert.strictEqual(res.body.rating_summary.count, 1);
    assert.strictEqual(res.body.rating_summary.average, '5.0');
  });
});
