import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { mapPurposeToDb } from '../../src/platform/http/routes/media-routes.ts';

describe('TDD Slice 1.2: Media Purpose & Shop Logo Attachment', () => {
  it('mapPurposeToDb maps shop_logo to SHOP_LOGO', () => {
    assert.strictEqual(mapPurposeToDb('shop_logo'), 'SHOP_LOGO');
    assert.strictEqual(mapPurposeToDb('SHOP_LOGO'), 'SHOP_LOGO');
  });

  it('rejects invalid purpose with MediaValidationError', () => {
    assert.throws(() => mapPurposeToDb('invalid_purpose'), (err: any) => {
      return err.code === 'VALIDATION_FAILED';
    });
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
