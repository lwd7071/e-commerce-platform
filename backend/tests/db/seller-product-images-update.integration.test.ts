import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { PgCatalogHttpService } from '../../src/modules/catalog/services/pg-catalog-http.service.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import {
  createFixtureUser,
  createFixtureShop,
  createFixtureCategory,
  createFixtureProduct,
  createFixtureVariant,
  applyShippingMigration,
} from './fixtures/database-fixtures.ts';

describe.skipIf(!parseRunRemoteDbTests(process.env))('Seller Product Images Update (real PostgreSQL)', () => {
  const schema = `prod_img_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let catalogService: PgCatalogHttpService;
  let sellerId: string;
  let shopId: string;
  let categoryId: string;
  let productId: string;
  let oldImg1Id: string;
  let oldImg2Id: string;

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

    // 3. Shop logo migration
    const shopLogoMigration = await readFile(new URL('../../prisma/migrations/20261001150000_shop_logo_media/migration.sql', import.meta.url), 'utf8');
    await pool.query(shopLogoMigration);
    await applyShippingMigration(pool);

    catalogService = new PgCatalogHttpService(pool);

    sellerId = randomUUID();
    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1)`, [sellerId]);
    await createFixtureUser(pool, { userId: sellerId, role: 'SELLER' });

    const shop = await createFixtureShop(pool, sellerId, { status: 'ACTIVE' });
    shopId = shop.shopId;

    const category = await createFixtureCategory(pool, { status: 'ACTIVE' });
    categoryId = category.categoryId;

    const product = await createFixtureProduct(pool, shopId, categoryId, { status: 'ACTIVE' });
    productId = product.productId;

    await createFixtureVariant(pool, productId, { status: 'ACTIVE' });

    // Seed 2 existing product images
    oldImg1Id = randomUUID();
    oldImg2Id = randomUUID();
    await pool.query(
      `INSERT INTO product_images (image_id, product_id, image_url, sort_order)
       VALUES ($1, $2, $3, $4), ($5, $2, $6, $7)`,
      [oldImg1Id, productId, 'https://storage.test/img1.png', 0, oldImg2Id, 'https://storage.test/img2.png', 1],
    );
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

  it('updates product images: keeps existing image_id, attaches new media_id, and removes omitted old image', async () => {
    const context = createRequestContext({
      request_id: 'req_test',
      user_id: sellerId,
      role: 'SELLER',
      shop_id: shopId,
      shop_status: 'ACTIVE',
    });

    const newMediaId = randomUUID();
    const storageUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || 'https://storage.test';
    const newObjectPath = `shops/${shopId}/products/${productId}/${newMediaId}.png`;
    const newPublicUrl = `${storageUrl}/storage/v1/object/public/product-media/${newObjectPath}`;

    // Insert newly finalized media_upload record
    await pool.query(
      `INSERT INTO media_uploads (media_id, owner_id, purpose, bucket_id, object_path, status, expires_at, finalized_at)
       VALUES ($1, $2, 'PRODUCT', 'product-media', $3, 'FINALIZED', now() + interval '1 hour', now())`,
      [newMediaId, sellerId, newObjectPath],
    );

    // Call updateSellerProduct retaining oldImg1Id, omitting oldImg2Id, and adding newMediaId
    await catalogService.updateSellerProduct(context, productId, {
      images: [
        {
          image_id: oldImg1Id,
          image_url: 'https://storage.test/img1.png',
          sort_order: 0,
        },
        {
          media_id: newMediaId,
          image_url: newPublicUrl,
          sort_order: 1,
        },
      ],
    });

    // Verify product_images in DB
    const res = await pool.query<{ image_id: string; image_url: string; sort_order: number }>(
      'SELECT image_id, image_url, sort_order FROM product_images WHERE product_id = $1 ORDER BY sort_order',
      [productId],
    );

    expect(res.rows).toHaveLength(2);

    // Retained old image
    expect(res.rows[0].image_url).toBe('https://storage.test/img1.png');
    expect(res.rows[0].sort_order).toBe(0);

    // Newly added image
    expect(res.rows[1].image_url).toBe(newPublicUrl);
    expect(res.rows[1].sort_order).toBe(1);

    // Omitted image2 is deleted from DB
    const oldImg2Check = await pool.query(
      'SELECT 1 FROM product_images WHERE image_id = $1',
      [oldImg2Id],
    );
    expect(oldImg2Check.rows).toHaveLength(0);

    // Verify media_uploads status transitioned to ATTACHED
    const mediaCheck = await pool.query<{ status: string }>(
      'SELECT status FROM media_uploads WHERE media_id = $1',
      [newMediaId],
    );
    expect(mediaCheck.rows[0].status).toBe('ATTACHED');
  });

  it('rejects adding new image when media upload belongs to a different seller or shop', async () => {
    const context = createRequestContext({
      request_id: 'req_test',
      user_id: sellerId,
      role: 'SELLER',
      shop_id: shopId,
      shop_status: 'ACTIVE',
    });

    const otherSellerId = randomUUID();
    const otherShopId = randomUUID();
    const invalidMediaId = randomUUID();
    const storageUrl = process.env.SUPABASE_URL?.replace(/\/$/, '') || 'https://storage.test';
    const invalidPath = `shops/${otherShopId}/products/${productId}/${invalidMediaId}.png`;
    const invalidUrl = `${storageUrl}/storage/v1/object/public/product-media/${invalidPath}`;

    await pool.query(`INSERT INTO ${schema}.auth_users (id) VALUES ($1)`, [otherSellerId]);
    await createFixtureUser(pool, { userId: otherSellerId, role: 'SELLER' });

    await pool.query(
      `INSERT INTO media_uploads (media_id, owner_id, purpose, bucket_id, object_path, status, expires_at, finalized_at)
       VALUES ($1, $2, 'PRODUCT', 'product-media', $3, 'FINALIZED', now() + interval '1 hour', now())`,
      [invalidMediaId, otherSellerId, invalidPath],
    );

    await expect(
      catalogService.updateSellerProduct(context, productId, {
        images: [
          {
            media_id: invalidMediaId,
            image_url: invalidUrl,
            sort_order: 0,
          },
        ],
      }),
    ).rejects.toThrow(/Product image must reference a finalized upload owned by this seller and product/);
  });
});
