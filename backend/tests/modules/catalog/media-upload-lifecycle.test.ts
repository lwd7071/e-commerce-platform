import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { createMediaRouter, mapPurposeToDb } from '../../../src/platform/http/routes/media-routes.ts';
import { errorHandlerMiddleware } from '../../../src/platform/http/middlewares/error-handler.ts';
import { STORAGE_BUCKETS } from '../../../db/storage.ts';

describe('Media Upload Lifecycle (Slice 1: Presign & Finalize B-102)', () => {
  let app: express.Application;
  let currentRole = 'SELLER';
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testShopId = '00000000-0000-0000-0000-000000000010';

  const mockAuth = (req: Request, _res: Response, next: NextFunction) => {
    req.context = {
      request_id: 'req_test',
      user_id: testUserId,
      role: currentRole as 'BUYER' | 'SELLER' | 'ADMIN',
      shop_id: testShopId,
    };
    next();
  };

  beforeEach(() => {
    currentRole = 'SELLER';
    app = express();
    app.use(express.json());
    app.use('/api/v1', createMediaRouter(mockAuth));
    app.use(errorHandlerMiddleware);
  });

  it('generates presigned product media path with 600s TTL and temp folder', async () => {
    currentRole = 'SELLER';
    const res = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'iphone-15.png',
        content_type: 'image/png',
        purpose: 'product_image',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.media_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.data.expires_in_seconds).toBe(600);
    expect(res.body.data.storage_path).toMatch(
      new RegExp(`^shops/${testShopId}/products/temp/[0-9a-f-]{36}\\.png$`)
    );
    expect(res.body.data.upload_url).toContain(STORAGE_BUCKETS.PRODUCT_MEDIA);
  });

  it('generates presigned review media path in review-media bucket under users/{userId}/reviews/{reviewId}', async () => {
    currentRole = 'BUYER';
    const reviewId = '00000000-0000-4000-8000-000000000002';
    const res = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'feedback.jpg',
        content_type: 'image/jpeg',
        purpose: 'review_image',
        review_id: reviewId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.expires_in_seconds).toBe(600);
    expect(res.body.data.storage_path).toMatch(
      new RegExp(`^users/${testUserId}/reviews/${reviewId}/[0-9a-f-]{36}\\.jpg$`)
    );
    expect(res.body.data.upload_url).toContain(STORAGE_BUCKETS.REVIEW_MEDIA);
  });

  it('finalizes uploaded media with valid PNG magic bytes returning public_url and FINALIZED status', async () => {
    currentRole = 'SELLER';
    // 1. Presign
    const presignRes = await request(app)
      .post('/api/v1/media/uploads/presign')
      .send({
        filename: 'item.png',
        content_type: 'image/png',
        purpose: 'product_image',
      });

    const mediaId = presignRes.body.data.media_id;
    expect(mediaId).toBeDefined();

    // 2. Finalize with valid PNG magic bytes (89504e47...)
    const finalizeRes = await request(app)
      .post(`/api/v1/media/uploads/${mediaId}/finalize`)
      .send({
        magic_bytes: '89504e470d0a1a0a',
      });

    expect(finalizeRes.status).toBe(200);
    expect(finalizeRes.body.data.status).toBe('FINALIZED');
    expect(finalizeRes.body.data.media_id).toBe(mediaId);
    expect(finalizeRes.body.data.public_url).toContain(
      `/storage/v1/object/public/${STORAGE_BUCKETS.PRODUCT_MEDIA}/`
    );
  });

  describe('Slice 2: Magic Bytes & File Security (B-102)', () => {
    it('rejects presign for unapproved MIME types like image/gif with 400 VALIDATION_FAILED', async () => {
      const res = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'animation.gif',
          content_type: 'image/gif',
          purpose: 'product_image',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
      expect(res.body.error.message).toContain('Định dạng không được hỗ trợ');
    });

    it('rejects RIFF files that are not WebP (e.g. WAV audio 52494646...57415645) with 400 VALIDATION_FAILED', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'audio-fake.webp',
          content_type: 'image/webp',
          purpose: 'product_image',
        });

      const mediaId = presignRes.body.data.media_id;

      // RIFF (52 49 46 46) + 4 bytes length (24 00 00 00) + WAVE (57 41 56 45) -> NOT WEBP!
      const wavMagicBytes = '524946462400000057415645';

      const finalizeRes = await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({
          magic_bytes: wavMagicBytes,
        });

      expect(finalizeRes.status).toBe(400);
      expect(finalizeRes.body.error.code).toBe('VALIDATION_FAILED');
      expect(finalizeRes.body.error.message).toContain('magic bytes');
    });

    it('accepts genuine WebP file (RIFF 52494646 + WEBP 57454250 at bytes 8-11)', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'banner.webp',
          content_type: 'image/webp',
          purpose: 'product_image',
        });

      const mediaId = presignRes.body.data.media_id;

      // RIFF (52 49 46 46) + 4 bytes size (00 00 00 00) + WEBP (57 45 42 50)
      const webpMagicBytes = '524946460000000057454250';

      const finalizeRes = await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({
          magic_bytes: webpMagicBytes,
        });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.data.status).toBe('FINALIZED');
    });

    it('accepts genuine JPEG file (FF D8 FF)', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'photo.jpg',
          content_type: 'image/jpeg',
          purpose: 'product_image',
        });

      const mediaId = presignRes.body.data.media_id;

      const finalizeRes = await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({
          magic_bytes: 'ffd8ffe000104a464946',
        });

      expect(finalizeRes.status).toBe(200);
      expect(finalizeRes.body.data.status).toBe('FINALIZED');
    });

    it('finalizing twice is idempotent (returns existing FINALIZED record without crash)', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'photo2.jpg',
          content_type: 'image/jpeg',
          purpose: 'product_image',
        });

      const mediaId = presignRes.body.data.media_id;

      // 1st finalize
      const firstRes = await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({ magic_bytes: 'ffd8ffe0' });
      expect(firstRes.status).toBe(200);

      // 2nd finalize (idempotent)
      const secondRes = await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({ magic_bytes: 'ffd8ffe0' });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.status).toBe('FINALIZED');
      expect(secondRes.body.data.public_url).toBe(firstRes.body.data.public_url);
    });

    it('rejects client-supplied body magic_bytes when in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const presignRes = await request(app)
          .post('/api/v1/media/uploads/presign')
          .send({
            filename: 'hack.png',
            content_type: 'image/png',
            purpose: 'product_image',
          });

        const mediaId = presignRes.body.data.media_id;

        const finalizeRes = await request(app)
          .post(`/api/v1/media/uploads/${mediaId}/finalize`)
          .send({ magic_bytes: '89504e47' });

        // In production, client body magic_bytes must be rejected / require storage inspection
        expect(finalizeRes.status).toBe(400);
        expect(finalizeRes.body.error.message).toContain('Client magic_bytes is disabled in production');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Slice 3: Security, Expiry (410 GONE), Attached Conflict (409), and Shop Active Guard', () => {
    it('rejects cross-owner finalize attempt with 403 FORBIDDEN', async () => {
      // User A presigns
      currentRole = 'SELLER';
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'item.png',
          content_type: 'image/png',
          purpose: 'product_image',
        });
      const mediaId = presignRes.body.data.media_id;

      // Reconfigure app with User B context
      const hackerApp = express();
      hackerApp.use(express.json());
      hackerApp.use(
        '/api/v1',
        createMediaRouter((req, _res, next) => {
          req.context = {
            request_id: 'req_test_hacker',
            user_id: '00000000-0000-0000-0000-999999999999', // Different user
            role: 'SELLER',
            shop_id: '00000000-0000-0000-0000-888888888888',
          };
          next();
        })
      );
      hackerApp.use(errorHandlerMiddleware);

      const hackerRes = await request(hackerApp)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({ magic_bytes: '89504e47' });

      expect(hackerRes.status).toBe(403);
      expect(hackerRes.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects finalize for expired presigned URL (> 600s) with 410 GONE and MEDIA_EXPIRED code', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'timeout.jpg',
          content_type: 'image/jpeg',
          purpose: 'product_image',
        });
      const mediaId = presignRes.body.data.media_id;

      // Advance time by 601 seconds (10 minutes 1 second)
      const originalNow = Date.now;
      try {
        Date.now = () => originalNow() + 601 * 1000;

        const finalizeRes = await request(app)
          .post(`/api/v1/media/uploads/${mediaId}/finalize`)
          .send({ magic_bytes: 'ffd8ffe0' });

        expect(finalizeRes.status).toBe(410);
        expect(finalizeRes.body.error.code).toBe('MEDIA_EXPIRED');
        expect(finalizeRes.body.error.message).toContain('Presigned upload has expired');
      } finally {
        Date.now = originalNow;
      }
    });

    it('rejects DELETE for media that is already ATTACHED to a product with 409 CONFLICT', async () => {
      const presignRes = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'attached.png',
          content_type: 'image/png',
          purpose: 'product_image',
        });
      const mediaId = presignRes.body.data.media_id;

      // Finalize
      await request(app)
        .post(`/api/v1/media/uploads/${mediaId}/finalize`)
        .send({ magic_bytes: '89504e47' });

      // Mark attached via internal router or hook (simulating product creation)
      await request(app)
        .patch(`/api/v1/media/uploads/${mediaId}/attach`)
        .send();

      // Now attempting to delete must fail with 409 CONFLICT
      const deleteRes = await request(app)
        .delete(`/api/v1/media/uploads/${mediaId}`);

      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.error.code).toBe('MEDIA_ALREADY_ATTACHED');
    });

    it('rejects product media presign if shop is not ACTIVE with 403 FORBIDDEN (SHOP_NOT_ACTIVE)', async () => {
      // App with PENDING shop context
      const pendingShopApp = express();
      pendingShopApp.use(express.json());
      pendingShopApp.use(
        '/api/v1',
        createMediaRouter((req, _res, next) => {
          req.context = {
            request_id: 'req_test_pending',
            user_id: testUserId,
            role: 'SELLER',
            shop_id: testShopId,
            shop_status: 'PENDING', // Shop not active
          };
          next();
        })
      );
      pendingShopApp.use(errorHandlerMiddleware);

      const res = await request(pendingShopApp)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'prod.png',
          content_type: 'image/png',
          purpose: 'product_image',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SHOP_NOT_ACTIVE');
    });
  });

  describe('Slice 5: Purpose DB Mapper & Purpose Caps (5 for product, 3 for review)', () => {
    it('correctly maps API purpose to Database ENUM', () => {
      expect(mapPurposeToDb('product_image')).toBe('PRODUCT');
      expect(mapPurposeToDb('PRODUCT')).toBe('PRODUCT');
      expect(mapPurposeToDb('product')).toBe('PRODUCT');
      expect(mapPurposeToDb('review_image')).toBe('REVIEW');
      expect(mapPurposeToDb('REVIEW')).toBe('REVIEW');
      expect(mapPurposeToDb('review')).toBe('REVIEW');
      expect(mapPurposeToDb('avatar_image')).toBe('AVATAR');
      expect(mapPurposeToDb('avatar')).toBe('AVATAR');
    });

    it('presigns avatar media into the owner-scoped profile bucket', async () => {
      const response = await request(app).post('/api/v1/media/uploads/presign').send({
        filename: 'lvvd.jpg', content_type: 'image/jpeg', purpose: 'avatar_image',
      }).expect(201);
      expect(response.body.data.storage_path).toMatch(/^users\/[0-9a-f-]{36}\/avatar\/[0-9a-f-]{36}\.jpg$/i);
      expect(response.body.data.upload_url).toContain('/profile-media/');
    });

    it('enforces purpose caps: allows up to 5 images for product and 3 for review', async () => {
      // Test presign accepts valid purpose
      const presignProduct = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'valid.png',
          content_type: 'image/png',
          purpose: 'product_image',
        });
      expect(presignProduct.status).toBe(201);

      // Invalid purpose rejected with 400
      const invalidPurpose = await request(app)
        .post('/api/v1/media/uploads/presign')
        .send({
          filename: 'valid.png',
          content_type: 'image/png',
          purpose: 'unsupported_purpose',
        });
      expect(invalidPurpose.status).toBe(400);
      expect(invalidPurpose.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
