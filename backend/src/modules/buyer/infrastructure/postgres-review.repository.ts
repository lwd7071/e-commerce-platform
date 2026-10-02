import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
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
  constructor(
    private readonly db: IDbClient,
    private readonly supabaseUrl?: string,
  ) {}

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

  async create(review: Review, images?: string[], mediaIds?: UUID[]): Promise<Review> {
    if (mediaIds?.length && !this.supabaseUrl) {
      throw new Error('SUPABASE_URL is required to attach review media');
    }
    const pool = this.db as IDbClient & Pick<Pool, 'connect'>;
    const client: PoolClient | IDbClient = typeof pool.connect === 'function' ? await pool.connect() : this.db;

    try {
      await client.query('BEGIN');

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
      const reviewRes = await client.query(reviewSql, params);
      const createdReview = mapReview(reviewRes.rows[0]);

      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const imageSql = `
            INSERT INTO review_images (review_image_id, review_id, image_url, sort_order)
            VALUES ($1, $2, $3, $4)
          `;
          const imageId = randomUUID();
          await client.query(imageSql, [imageId, createdReview.reviewId, images[i], i]);
        }
      }

      if (mediaIds && mediaIds.length > 0) {
        const expectedPrefix = `users/${review.buyerId}/reviews/${review.reviewId}/`;
        for (let i = 0; i < mediaIds.length; i++) {
          const mId = mediaIds[i];
          const mediaCheck = await client.query(
            `SELECT owner_id,purpose,status,object_path FROM media_uploads WHERE media_id=$1 FOR UPDATE`,
            [mId],
          );
          const row = mediaCheck.rows?.[0];
          if (!row || row.owner_id !== review.buyerId || row.purpose !== 'REVIEW' || row.status !== 'FINALIZED') {
            throw new Error(`Media ${mId} is not a finalized review media owned by this buyer`);
          }
          if (typeof row.object_path !== 'string' || !row.object_path.startsWith(expectedPrefix)) {
            throw new Error(`Media ${mId} object_path (${row.object_path}) does not match review path prefix ${expectedPrefix}`);
          }
          await client.query(
            `UPDATE media_uploads SET status='ATTACHED', attached_at=now(), updated_at=now() WHERE media_id=$1`,
            [mId],
          );
          const publicUrl = `${this.supabaseUrl!.replace(/\/$/, '')}/storage/v1/object/public/review-media/${row.object_path}`;
          const imageSql = `
            INSERT INTO review_images (review_image_id, review_id, image_url, sort_order)
            VALUES ($1, $2, $3, $4)
          `;
          const imageId = randomUUID();
          await client.query(imageSql, [imageId, createdReview.reviewId, publicUrl, i]);
        }
      }

      await client.query('COMMIT');
      return createdReview;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      if ('release' in client && typeof client.release === 'function') {
        client.release();
      }
    }
  }
}
