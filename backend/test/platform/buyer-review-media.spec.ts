import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { mapPurposeToDb } from '../../src/platform/http/routes/media-routes.ts';
import { registerPresignedMedia } from '../../db/media-lifecycle.ts';
import { buildReviewImagePath, STORAGE_BUCKETS } from '../../db/storage.ts';

describe('TDD Slice 1: Buyer Review Media Presign', () => {
  const buyerId = '11111111-1111-4111-8111-111111111111';
  const reviewId = '22222222-2222-4222-8222-222222222222';
  const mediaId = '33333333-3333-4333-8333-333333333333';

  it('mapPurposeToDb maps review_image and REVIEW to REVIEW', () => {
    assert.strictEqual(mapPurposeToDb('review_image'), 'REVIEW');
    assert.strictEqual(mapPurposeToDb('REVIEW'), 'REVIEW');
  });

  it('registerPresignedMedia registers review media successfully', async () => {
    let inserted = false;
    const mockClient = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO media_uploads')) {
          inserted = true;
          assert.strictEqual(params?.[1], buyerId);
          assert.strictEqual(params?.[2], 'REVIEW');
          assert.strictEqual(params?.[3], STORAGE_BUCKETS.REVIEW_MEDIA);
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
    };

    await registerPresignedMedia(mockClient, {
      mediaId,
      ownerId: buyerId,
      purpose: 'REVIEW',
      bucketId: STORAGE_BUCKETS.REVIEW_MEDIA,
      objectPath: buildReviewImagePath(buyerId, reviewId, mediaId, 'jpg'),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    });

    assert.strictEqual(inserted, true);
  });

  it('POST /media/uploads/presign for review_image succeeds with valid review_id', async () => {
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
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'review1.jpg',
        purpose: 'review_image',
        content_type: 'image/jpeg',
        review_id: reviewId,
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.data.upload_url);
    assert.ok(res.body.data.media_id);
    assert.strictEqual(
      res.body.data.storage_path,
      `users/${buyerId}/reviews/${reviewId}/${res.body.data.media_id}.jpg`,
    );
  });

  it('POST /media/uploads/presign rejects when review_id is missing or invalid', async () => {
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

    const resMissing = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'review1.jpg',
        purpose: 'review_image',
        content_type: 'image/jpeg',
      });

    assert.strictEqual(resMissing.status, 400);
    assert.strictEqual(resMissing.body.error.code, 'VALIDATION_FAILED');

    const resInvalid = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'review1.jpg',
        purpose: 'review_image',
        content_type: 'image/jpeg',
        review_id: 'invalid-uuid',
      });

    assert.strictEqual(resInvalid.status, 400);
    assert.strictEqual(resInvalid.body.error.code, 'VALIDATION_FAILED');
  });

  it('POST /media/uploads/presign with runtime creates signed URL for review-media', async () => {
    const context = createRequestContext({
      request_id: 'req_test',
      user_id: buyerId,
      role: 'BUYER',
    });

    let registered = false;
    const mockPool = {
      query: async (sql: string, _params?: unknown[]) => {
        if (sql.includes('INSERT INTO media_uploads')) {
          registered = true;
          return { rowCount: 1, rows: [] };
        }
        return { rowCount: 1, rows: [] };
      },
    } as unknown as Pool;

    const mockStorage = {
      storage: {
        from: (bucket: string) => {
          assert.strictEqual(bucket, STORAGE_BUCKETS.REVIEW_MEDIA);
          return {
            createSignedUploadUrl: async (path: string) => {
              return {
                data: { signedUrl: `https://supabase.co/signed/${path}` },
                error: null,
              };
            },
          };
        },
      },
    } as unknown as SupabaseClient;

    const app = createApp({
      auth: (req, _res, next) => {
        req.context = context;
        next();
      },
      pool: mockPool,
      mediaStorage: mockStorage,
    });

    const res = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'review1.jpg',
        purpose: 'review_image',
        content_type: 'image/jpeg',
        review_id: reviewId,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(registered, true);
    assert.ok(res.body.data.upload_url.includes('https://supabase.co/signed/'));
  });
});
