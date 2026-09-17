import { randomUUID } from 'node:crypto';
import type { IReviewRepository } from '../domain/repositories';
import type { UUID, Review } from '../domain/types';
import type { IDbClient } from './db-client';
import { mapReview } from './row-mappers';

/**
 * SOLID Design Principles:
 * - Single Responsibility (S): Quản lý đọc/ghi Review và ReviewImage vào PostgreSQL.
 * - Dependency Inversion (D): Nhận IDbClient trừu tượng qua constructor injection.
 * - Liskov Substitution (L): Tuân thủ hoàn toàn IReviewRepository interface contract.
 */
export class PostgresReviewRepository implements IReviewRepository {
  constructor(private readonly db: IDbClient) {}

  async findById(reviewId: UUID): Promise<Review | null> {
    const sql = `SELECT review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at FROM reviews WHERE review_id = $1`;
    const result = await this.db.query(sql, [reviewId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapReview(result.rows[0]);
  }

  async findByOrderItemId(orderItemId: UUID): Promise<Review | null> {
    const sql = `SELECT review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at FROM reviews WHERE order_item_id = $1`;
    const result = await this.db.query(sql, [orderItemId]);
    if (!result.rows || result.rows.length === 0) {
      return null;
    }
    return mapReview(result.rows[0]);
  }

  async findByProductId(productId: UUID): Promise<Review[]> {
    const sql = `SELECT review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at FROM reviews WHERE product_id = $1 AND status = 'VISIBLE' ORDER BY created_at DESC`;
    const result = await this.db.query(sql, [productId]);
    return (result.rows ?? []).map(mapReview);
  }

  async create(review: Review, images?: string[]): Promise<Review> {
    const reviewSql = `
      INSERT INTO reviews (
        review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), now())
      RETURNING review_id, buyer_id, product_id, order_item_id, rating, content, status, created_at, updated_at
    `;
    const params = [
      review.reviewId,
      review.buyerId,
      review.productId,
      review.orderItemId,
      review.rating,
      review.content,
      review.status,
      review.createdAt ?? null,
    ];
    const reviewRes = await this.db.query(reviewSql, params);
    const createdReview = mapReview(reviewRes.rows[0]);

    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const imageSql = `
          INSERT INTO review_images (review_image_id, review_id, image_url, sort_order)
          VALUES ($1, $2, $3, $4)
        `;
        const imageId = randomUUID();
        await this.db.query(imageSql, [imageId, createdReview.reviewId, images[i], i]);
      }
    }

    return createdReview;
  }
}
