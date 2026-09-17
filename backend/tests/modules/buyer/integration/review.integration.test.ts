import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresReviewRepository } from '../../../../src/modules/buyer/infrastructure/postgres-review.repository';
import { mapReview, mapReviewImage } from '../../../../src/modules/buyer/infrastructure/row-mappers';
import { mockReview, mockBuyerId } from '../fixtures';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

class MockDbClient {
  public queries: { sql: string; params: any[] }[] = [];
  public customHandler?: (sql: string, params: any[]) => Promise<any>;

  async query(sql: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    this.queries.push({ sql: sql.trim(), params });
    if (this.customHandler) {
      return this.customHandler(sql, params);
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('Phase 4 — PostgresReviewRepository (SOLID: S, L, D)', () => {
  describe('Row Mappers (SOLID: S — Single Responsibility)', () => {
    it('mapReview: chuyển đổi snake_case sang Review domain model', () => {
      const row = {
        review_id: mockReview.reviewId,
        buyer_id: mockBuyerId,
        product_id: mockReview.productId,
        order_item_id: mockReview.orderItemId,
        rating: 5,
        content: 'Chất lượng tuyệt hảo!',
        status: 'VISIBLE',
        created_at: new Date('2026-09-17T10:00:00.000Z'),
        updated_at: new Date('2026-09-17T10:00:00.000Z'),
      };
      const review = mapReview(row);
      assert.strictEqual(review.reviewId, mockReview.reviewId);
      assert.strictEqual(review.rating, 5);
      assert.strictEqual(review.status, 'VISIBLE');
    });

    it('mapReviewImage: chuyển đổi snake_case sang ReviewImage domain model', () => {
      const row = {
        review_image_id: 'img11111-1111-4111-8111-111111111111',
        review_id: mockReview.reviewId,
        image_url: 'https://example.com/img1.jpg',
        sort_order: 0,
      };
      const img = mapReviewImage(row);
      assert.strictEqual(img.reviewImageId, 'img11111-1111-4111-8111-111111111111');
      assert.strictEqual(img.sortOrder, 0);
    });
  });

  describe('PostgresReviewRepository operations (SOLID: L, D)', () => {
    it('[TEST-INT-13] findById: trả về review nếu tìm thấy hoặc null nếu không có', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          review_id: mockReview.reviewId,
          buyer_id: mockBuyerId,
          product_id: mockReview.productId,
          order_item_id: mockReview.orderItemId,
          rating: 5,
          content: mockReview.content,
          status: 'VISIBLE',
          created_at: new Date(mockReview.createdAt),
          updated_at: new Date(mockReview.updatedAt),
        }],
        rowCount: 1,
      });

      const repo = new PostgresReviewRepository(client as IDbClient);
      const res = await repo.findById(mockReview.reviewId);

      assert.ok(res);
      assert.strictEqual(res.reviewId, mockReview.reviewId);
      assert.ok(client.queries[0].sql.includes('FROM reviews WHERE review_id = $1'));
    });

    it('[TEST-INT-13] findByOrderItemId: tìm kiếm chính xác theo order_item_id', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({
        rows: [{
          review_id: mockReview.reviewId,
          buyer_id: mockBuyerId,
          product_id: mockReview.productId,
          order_item_id: mockReview.orderItemId,
          rating: 5,
          content: mockReview.content,
          status: 'VISIBLE',
          created_at: new Date(mockReview.createdAt),
          updated_at: new Date(mockReview.updatedAt),
        }],
        rowCount: 1,
      });

      const repo = new PostgresReviewRepository(client as IDbClient);
      const res = await repo.findByOrderItemId(mockReview.orderItemId);

      assert.ok(res);
      assert.strictEqual(res.orderItemId, mockReview.orderItemId);
      assert.ok(client.queries[0].sql.includes('FROM reviews WHERE order_item_id = $1'));
    });

    it('[TEST-INT-14] findByProductId: chỉ trả về các review có status = VISIBLE theo thứ tự mới nhất', async () => {
      const client = new MockDbClient();
      client.customHandler = async () => ({ rows: [], rowCount: 0 });

      const repo = new PostgresReviewRepository(client as IDbClient);
      await repo.findByProductId(mockReview.productId);

      const sql = client.queries[0].sql;
      assert.ok(sql.includes('product_id = $1'));
      assert.ok(sql.includes("status = 'VISIBLE'"));
      assert.ok(sql.includes('ORDER BY created_at DESC'));
    });

    it('[TEST-INT-15] create: chèn review và lưu danh sách hình ảnh đi kèm', async () => {
      const client = new MockDbClient();
      client.customHandler = async (_sql, params) => ({
        rows: [{
          review_id: params[0],
          buyer_id: params[1],
          product_id: params[2],
          order_item_id: params[3],
          rating: params[4],
          content: params[5],
          status: params[6],
          created_at: new Date('2026-09-17T10:00:00.000Z'),
          updated_at: new Date('2026-09-17T10:00:00.000Z'),
        }],
        rowCount: 1,
      });

      const repo = new PostgresReviewRepository(client as IDbClient);
      const images = ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'];
      const created = await repo.create(mockReview, images);

      assert.strictEqual(created.reviewId, mockReview.reviewId);
      assert.strictEqual(client.queries.length, 3); // 1 insert review + 2 insert review_images
      assert.ok(client.queries[0].sql.includes('INSERT INTO reviews'));
      assert.ok(client.queries[1].sql.includes('INSERT INTO review_images'));
      assert.ok(client.queries[2].sql.includes('INSERT INTO review_images'));
    });

    it('[TEST-INT-16] Rating constraint violation (RB-MG08): lan truyền lỗi check constraint 23514', async () => {
      const client = new MockDbClient();
      const checkError = Object.assign(new Error('new row for relation "reviews" violates check constraint "ck_reviews__rating"'), {
        code: '23514',
        constraint: 'ck_reviews__rating',
      });
      client.customHandler = async () => { throw checkError; };

      const repo = new PostgresReviewRepository(client as IDbClient);
      await assert.rejects(
        () => repo.create({ ...mockReview, rating: 6 }),
        (err: any) => err.code === '23514' && err.constraint === 'ck_reviews__rating'
      );
    });

    it('[TEST-INT-16] Duplicate order_item_id (RB-LB09): lan truyền lỗi unique constraint 23505', async () => {
      const client = new MockDbClient();
      const dupError = Object.assign(new Error('duplicate key value violates unique constraint "uq_reviews__order_item_id"'), {
        code: '23505',
        constraint: 'uq_reviews__order_item_id',
      });
      client.customHandler = async () => { throw dupError; };

      const repo = new PostgresReviewRepository(client as IDbClient);
      await assert.rejects(
        () => repo.create(mockReview),
        (err: any) => err.code === '23505' && err.constraint === 'uq_reviews__order_item_id'
      );
    });
  });
});
