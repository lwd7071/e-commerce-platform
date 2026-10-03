import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { mapPurposeToDb } from '../../src/platform/http/routes/media-routes.ts';
import { registerPresignedMedia } from '../../db/media-lifecycle.ts';
import { buildShopLogoPath, STORAGE_BUCKETS } from '../../db/storage.ts';

describe('TDD Slice 1.2: Media Purpose & Shop Logo Attachment', () => {
  it('mapPurposeToDb maps shop_logo to SHOP_LOGO', () => {
    assert.strictEqual(mapPurposeToDb('shop_logo'), 'SHOP_LOGO');
    assert.strictEqual(mapPurposeToDb('SHOP_LOGO'), 'SHOP_LOGO');
  });

  it('rejects invalid purpose with MediaValidationError', () => {
    assert.throws(() => mapPurposeToDb('invalid_purpose'), (err: unknown) => {
      const error = err as { code?: string };
      return error.code === 'VALIDATION_FAILED';
    });
  });

  it('registerPresignedMedia rejects when shop is not owned by the caller', async () => {
    const ownerId = '11111111-1111-4111-8111-111111111111';
    const attackerId = '22222222-2222-4222-8222-222222222222';
    const shopId = '33333333-3333-4333-8333-333333333333';
    const mediaId = '44444444-4444-4444-8444-444444444444';

    const mockClient = {
      query: async (sql: string) => {
        if (sql.includes('FROM shops')) {
          // Shop belongs to ownerId, not attackerId
          return { rowCount: 1, rows: [{ owner_id: ownerId, status: 'ACTIVE' }] };
        }
        return { rowCount: 1, rows: [] };
      },
    };

    await assert.rejects(
      () =>
        registerPresignedMedia(mockClient, {
          mediaId,
          ownerId: attackerId,
          purpose: 'SHOP_LOGO',
          bucketId: STORAGE_BUCKETS.PRODUCT_MEDIA,
          objectPath: buildShopLogoPath(shopId, 'png'),
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        }),
      /shop logo must be owned by this user/,
    );
  });

  it('POST /media/uploads/presign for shop_logo rejects when shop_id does not match context', async () => {
    const sellerId = '11111111-1111-4111-8111-111111111111';
    const shopId = '22222222-2222-4222-8222-222222222222';
    const otherShopId = '33333333-3333-4333-8333-333333333333';

    const context = createRequestContext({
      request_id: 'req_test',
      user_id: sellerId,
      role: 'SELLER',
      shop_id: shopId,
      shop_status: 'ACTIVE',
    });

    const app = createApp({
      auth: (req, _res, next) => {
        req.context = context;
        next();
      },
    });

    const res = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'logo.png',
        purpose: 'shop_logo',
        content_type: 'image/png',
        shop_id: otherShopId,
      })
      .expect(403);

    assert.strictEqual(res.body.error.code, 'FORBIDDEN');
  });

  it('PATCH /seller/shop/logo rejects invalid media_id with 400', async () => {
    const sellerId = '11111111-1111-4111-8111-111111111111';
    const shopId = '22222222-2222-4222-8222-222222222222';
    const context = createRequestContext({
      request_id: 'req_test',
      user_id: sellerId,
      role: 'SELLER',
      shop_id: shopId,
      shop_status: 'ACTIVE',
    });

    const app = createApp({
      auth: (req, _res, next) => {
        req.context = context;
        next();
      },
    });

    const res = await request(app)
      .patch('/api/v1/seller/shop/logo')
      .send({ media_id: 'not-a-uuid' })
      .expect(400);

    assert.strictEqual(res.body.error.code, 'VALIDATION_FAILED');
  });

  it('PATCH /seller/shop/logo rejects non-seller role with 403', async () => {
    const buyerId = '33333333-3333-4333-8333-333333333333';
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
    });

    const res = await request(app)
      .patch('/api/v1/seller/shop/logo')
      .send({ media_id: '44444444-4444-4444-8444-444444444444' })
      .expect(403);

    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
  });
});
