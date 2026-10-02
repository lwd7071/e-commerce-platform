import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PostgresReviewRepository } from '../../src/modules/buyer/infrastructure/postgres-review.repository.ts';

const remoteDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

remoteDescribe('Review media attachment transaction (isolated PostgreSQL schema)', { sequential: true }, () => {
  const schema = `review_media_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let repository: PostgresReviewRepository;
  let supabaseUrl: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    supabaseUrl = config.supabaseUrl.toString().replace(/\/$/, '');
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 3,
      connectionTimeoutMillis: config.pool.connectionTimeoutMillis,
      options: `-c search_path=${schema}`,
      application_name: schema,
    });
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE reviews (
        review_id uuid PRIMARY KEY, buyer_id uuid NOT NULL, product_id uuid NOT NULL,
        order_item_id uuid NOT NULL UNIQUE, rating smallint NOT NULL, content text,
        status varchar(20) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE review_images (
        review_image_id uuid PRIMARY KEY, review_id uuid NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
        image_url text NOT NULL, sort_order integer NOT NULL
      );
      CREATE TABLE media_uploads (
        media_id uuid PRIMARY KEY, owner_id uuid NOT NULL, purpose varchar(20) NOT NULL,
        status varchar(20) NOT NULL, object_path text NOT NULL, attached_at timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    repository = new PostgresReviewRepository(pool, supabaseUrl);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 20_000);

  const makeReview = (buyerId: string, productId: string, orderItemId: string, reviewId = randomUUID()) => ({
    reviewId,
    buyerId,
    productId,
    orderItemId,
    rating: 5,
    content: 'Verified PostgreSQL review media transaction',
    status: 'VISIBLE' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  it('rolls back the review when the finalized media belongs to a different review path', async () => {
    const buyerId = randomUUID();
    const review = makeReview(buyerId, randomUUID(), randomUUID());
    const mediaId = randomUUID();
    await pool.query(
      `INSERT INTO media_uploads (media_id, owner_id, purpose, status, object_path, updated_at)
       VALUES ($1, $2, 'REVIEW', 'FINALIZED', $3, now())`,
      [mediaId, buyerId, `users/${buyerId}/reviews/${randomUUID()}/${mediaId}.jpg`],
    );

    await expect(repository.create(review, undefined, [mediaId])).rejects.toThrow(/does not match review path prefix/);

    const persisted = await pool.query('SELECT review_id FROM reviews WHERE review_id=$1', [review.reviewId]);
    const media = await pool.query('SELECT status FROM media_uploads WHERE media_id=$1', [mediaId]);
    expect(persisted.rowCount).toBe(0);
    expect(media.rows[0]?.status).toBe('FINALIZED');
  });

  it('commits the review, attaches its media, and stores the configured Supabase public URL', async () => {
    const buyerId = randomUUID();
    const review = makeReview(buyerId, randomUUID(), randomUUID());
    const mediaId = randomUUID();
    const objectPath = `users/${buyerId}/reviews/${review.reviewId}/${mediaId}.jpg`;
    await pool.query(
      `INSERT INTO media_uploads (media_id, owner_id, purpose, status, object_path, updated_at)
       VALUES ($1, $2, 'REVIEW', 'FINALIZED', $3, now())`,
      [mediaId, buyerId, objectPath],
    );

    await repository.create(review, undefined, [mediaId]);

    const storedReview = await pool.query('SELECT review_id FROM reviews WHERE review_id=$1', [review.reviewId]);
    const storedMedia = await pool.query('SELECT status FROM media_uploads WHERE media_id=$1', [mediaId]);
    const image = await pool.query('SELECT image_url FROM review_images WHERE review_id=$1', [review.reviewId]);
    expect(storedReview.rowCount).toBe(1);
    expect(storedMedia.rows[0]?.status).toBe('ATTACHED');
    expect(image.rows[0]?.image_url).toBe(`${supabaseUrl}/storage/v1/object/public/review-media/${objectPath}`);
  });
});
