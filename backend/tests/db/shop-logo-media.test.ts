import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadDatabaseConfig } from '../../db/config.ts';
import { registerPresignedMedia } from '../../db/media-lifecycle.ts';
import { STORAGE_BUCKETS, buildShopLogoPath } from '../../db/storage.ts';
import { createFixtureUser, createFixtureShop } from './fixtures/database-fixtures.ts';

describe('Shop Logo Media Constraint & Ownership (real PostgreSQL)', () => {
  const schema = `shop_logo_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let sellerA: string;
  let sellerB: string;
  let shopA: string;
  let shopB: string;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = new pg.Pool({
      connectionString: config.directUrl.toString(),
      max: 4,
      options: `-c search_path=${schema},public`,
    });

    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`SET search_path TO ${schema}, public`);
    await pool.query(`CREATE TABLE ${schema}.auth_users (id uuid PRIMARY KEY)`);

    // 1. Initial schema
    const initial = await readFile(new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url), 'utf8');
    await pool.query(initial.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '').replaceAll('auth.users', `${schema}.auth_users`).replaceAll('public.', `${schema}.`));

    // 2. Media upload lifecycle table migration
    const mediaLifecycle = await readFile(new URL('../../prisma/migrations/20260930150000_media_upload_lifecycle/migration.sql', import.meta.url), 'utf8');
    await pool.query(mediaLifecycle.replaceAll('FROM PUBLIC, anon, authenticated', 'FROM PUBLIC'));

    // 3. New shop logo migration
    const shopLogoMigration = await readFile(new URL('../../prisma/migrations/20261001150000_shop_logo_media/migration.sql', import.meta.url), 'utf8');
    await pool.query(shopLogoMigration);

    sellerA = randomUUID();
    sellerB = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1), ($2)`, [sellerA, sellerB]);
    await createFixtureUser(pool, { userId: sellerA, role: 'SELLER' });
    await createFixtureUser(pool, { userId: sellerB, role: 'SELLER' });

    shopA = (await createFixtureShop(pool, sellerA, { status: 'ACTIVE' })).shopId;
    shopB = (await createFixtureShop(pool, sellerB, { status: 'ACTIVE' })).shopId;
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  it('allows registering presigned media with purpose SHOP_LOGO and bucket product-media after applying migration', async () => {
    const mediaId = randomUUID();
    const objectPath = buildShopLogoPath(shopA, 'png');

    await registerPresignedMedia(pool, {
      mediaId,
      ownerId: sellerA,
      purpose: 'SHOP_LOGO',
      bucketId: STORAGE_BUCKETS.PRODUCT_MEDIA,
      objectPath,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    const res = await pool.query<{ purpose: string; bucket_id: string }>(
      `SELECT purpose, bucket_id FROM ${schema}.media_uploads WHERE media_id = $1`,
      [mediaId],
    );

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].purpose).toBe('SHOP_LOGO');
    expect(res.rows[0].bucket_id).toBe('product-media');
  });

  it('rejects presigned media registration if shop belongs to another user', async () => {
    const mediaId = randomUUID();
    // sellerA attempts to upload logo for shopB (owned by sellerB)
    const objectPath = buildShopLogoPath(shopB, 'png');

    await expect(
      registerPresignedMedia(pool, {
        mediaId,
        ownerId: sellerA,
        purpose: 'SHOP_LOGO',
        bucketId: STORAGE_BUCKETS.PRODUCT_MEDIA,
        objectPath,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      }),
    ).rejects.toThrow(/shop logo must be owned by this user/);
  });

  it('rejects SHOP_LOGO with wrong bucket_id like profile-media via migration check constraint', async () => {
    const mediaId = randomUUID();
    const objectPath = buildShopLogoPath(shopA, 'png');

    await expect(
      pool.query(
        `INSERT INTO ${schema}.media_uploads (
          media_id, owner_id, bucket_id, object_path, purpose, status, expires_at
        ) VALUES ($1, $2, $3, $4, $5, 'PRESIGNED', now() + interval '15 minutes')`,
        [mediaId, sellerA, STORAGE_BUCKETS.PROFILE_MEDIA, objectPath, 'SHOP_LOGO'],
      ),
    ).rejects.toThrow();
  });
});
