import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool } from 'pg';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { validateCreateReviewDTO } from '../../src/modules/buyer/contracts/buyer.dto.ts';
import { ReviewService } from '../../src/modules/buyer/services/review.service.ts';
import { PostgresReviewRepository } from '../../src/modules/buyer/infrastructure/postgres-review.repository.ts';
import type { IOrderQueryPort } from '../../src/modules/buyer/ports/order-query.port.ts';

describe('TDD Slice 2: Atomic Review Creation with Media', () => {
  const buyerId = '11111111-1111-4111-8111-111111111111';
  const orderItemId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';
  const productId = '44444444-4444-4444-8444-444444444444';
  const reviewId = '55555555-5555-4555-8555-555555555555';
  const mediaId1 = '66666666-6666-4666-8666-666666666666';

  describe('validateCreateReviewDTO validation', () => {
    it('accepts review_id and image_media_ids in payload', () => {
      const parsed = validateCreateReviewDTO({
        rating: 5,
        content: 'Sản phẩm rất tốt và chất lượng',
        review_id: reviewId,
        image_media_ids: [mediaId1],
      });

      assert.strictEqual(parsed.rating, 5);
      assert.strictEqual(parsed.reviewId, reviewId);
      assert.deepStrictEqual(parsed.imageMediaIds, [mediaId1]);
    });

    it('rejects invalid review_id or invalid media_id', () => {
      assert.throws(() => {
        validateCreateReviewDTO({
          rating: 5,
          review_id: 'not-a-uuid',
        });
      });

      assert.throws(() => {
        validateCreateReviewDTO({
          rating: 5,
          image_media_ids: ['invalid-uuid'],
        });
      });
    });

    it('rejects more than 3 image media ids', () => {
      assert.throws(() => {
        validateCreateReviewDTO({
          rating: 5,
          image_media_ids: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222',
            '33333333-3333-4333-8333-333333333333',
            '44444444-4444-4444-8444-444444444444',
          ],
        });
      });
    });
  });

  describe('ReviewService and Route execution', () => {
    it('POST /api/v1/order-items/:order_item_id/review creates review with review_id and media', async () => {
      const mockOrderQuery: IOrderQueryPort = {
        getOrderItemForReview: async (_orderItemId: string, _buyerId: string) => ({
          orderItemId,
          orderId,
          productId,
          buyerId,
          orderStatus: 'COMPLETED',
        }),
        getOrderSummary: async () => null,
      };

      const mockDb = {
        query: async (sql: string, params?: unknown[]) => {
          if (sql.includes('FROM reviews WHERE order_item_id')) {
            return { rows: [], rowCount: 0 };
          }
          if (sql.includes('INSERT INTO reviews')) {
            return {
              rows: [{
                review_id: params?.[0] || reviewId,
                buyer_id: buyerId,
                product_id: productId,
                order_item_id: orderItemId,
                rating: params?.[4] || 5,
                content: params?.[5] || 'Tuyệt vời',
                status: 'VISIBLE',
                created_at: new Date(),
                updated_at: new Date(),
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('SELECT owner_id,purpose,status,object_path FROM media_uploads')) {
            return {
              rows: [{
                owner_id: buyerId,
                purpose: 'REVIEW',
                status: 'FINALIZED',
                object_path: `users/${buyerId}/reviews/${reviewId}/${mediaId1}.jpg`,
              }],
              rowCount: 1,
            };
          }
          if (sql.includes('UPDATE media_uploads')) {
            return { rowCount: 1, rows: [] };
          }
          if (sql.includes('INSERT INTO review_images')) {
            return { rowCount: 1, rows: [] };
          }
          return { rows: [], rowCount: 0 };
        },
      };

      const repo = new PostgresReviewRepository(mockDb as unknown as Pool);
      const service = new ReviewService(repo, mockOrderQuery);

      const context = createRequestContext({
        request_id: 'req_test',
        user_id: buyerId,
        role: 'BUYER',
      });

      const app = createApp({
        auth: (req, _res, next) => {
          req.context = context;
          next();
        },
        buyerServices: {
          reviewService: service,
        },
      });

      const res = await request(app)
        .post(`/api/v1/order-items/${orderItemId}/review`)
        .send({
          rating: 5,
          content: 'Sản phẩm giao nhanh và rất đẹp!',
          review_id: reviewId,
          image_media_ids: [mediaId1],
        });

      assert.strictEqual(res.status, 201);
      assert.strictEqual(res.body.data.review_id, reviewId);
      assert.strictEqual(res.body.data.rating, 5);
    });
  });
});
