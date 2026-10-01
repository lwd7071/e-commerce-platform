import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadDatabaseConfig } from '../../db/config.ts';
import { registerPresignedMedia } from '../../db/media-lifecycle.ts';
import { STORAGE_BUCKETS, buildShopLogoPath } from '../../db/storage.ts';

describe('Shop Logo Media Constraint (real PostgreSQL)', () => {
  let pool: pg.Pool;
  const schema = `shop_logo_test_${randomUUID().replaceAll('-', '')}`;
  const sellerId = randomUUID();
  const shopId = randomUUID();

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 4,
    });
    // Copy media_uploads structure into isolated schema
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE ${schema}.auth_users (
        id uuid PRIMARY KEY
      );
      CREATE TABLE ${schema}.media_uploads (
        media_id uuid PRIMARY KEY,
        owner_id uuid NOT NULL,
        bucket_id varchar(50) NOT NULL,
        object_path text NOT NULL,
        content_type varchar(100) NOT NULL,
        byte_size integer NOT NULL,
        purpose varchar(50) NOT NULL,
        status varchar(30) NOT NULL,
        expires_at timestamptz NOT NULL,
        finalized_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_media_uploads__purpose CHECK (purpose IN ('PRODUCT', 'REVIEW', 'AVATAR', 'SHOP_LOGO')),
        CONSTRAINT ck_media_uploads__bucket_id CHECK (
          (purpose = 'PRODUCT' AND bucket_id = 'product-media')
          OR (purpose = 'SHOP_LOGO' AND bucket_id = 'product-media')
          OR (purpose = 'REVIEW' AND bucket_id = 'review-media')
          OR (purpose = 'AVATAR' AND bucket_id = 'profile-media')
        )
      );
    `);
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1)`, [sellerId]);
  }, 30_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  it('allows registering presigned media with purpose SHOP_LOGO and bucket product-media', async () => {
    const mediaId = randomUUID();
    const objectPath = buildShopLogoPath(shopId, 'png');

    const res = await pool.query(
      `INSERT INTO ${schema}.media_uploads (
        media_id, owner_id, bucket_id, object_path, content_type, byte_size, purpose, status, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '15 minutes')
      RETURNING *`,
      [mediaId, sellerId, STORAGE_BUCKETS.PRODUCT_MEDIA, objectPath, 'image/png', 1024 * 50, 'SHOP_LOGO', 'PRESIGNED']
    );

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].purpose).toBe('SHOP_LOGO');
    expect(res.rows[0].bucket_id).toBe('product-media');
  });

  it('rejects SHOP_LOGO with wrong bucket_id like profile-media', async () => {
    const mediaId = randomUUID();
    const objectPath = buildShopLogoPath(shopId, 'png');

    await expect(
      pool.query(
        `INSERT INTO ${schema}.media_uploads (
          media_id, owner_id, bucket_id, object_path, content_type, byte_size, purpose, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now() + interval '15 minutes')`,
        [mediaId, sellerId, STORAGE_BUCKETS.PROFILE_MEDIA, objectPath, 'image/png', 1024 * 50, 'SHOP_LOGO', 'PRESIGNED']
      )
    ).rejects.toThrow();
  });
});
