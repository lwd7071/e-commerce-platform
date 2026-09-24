import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewImageEntity } from '../../../../src/modules/buyer/domain/media.ts';
import { ReviewMediaService } from '../../../../src/modules/buyer/services/review-media.service.ts';
import { ValidationError } from '../../../../src/modules/buyer/domain/errors.ts';

describe('ReviewMediaService and ReviewImageEntity Tests (TDD - Storage RLS & Path Validation)', () => {
  const mediaService = new ReviewMediaService('https://supabase.co/storage/v1/object/public/review-media');

  const userId = '11111111-1111-4111-8111-111111111111';
  const reviewId = '22222222-2222-4222-8222-222222222222';
  const imageId = '33333333-3333-4333-8333-333333333333';
  const otherUserId = '88888888-8888-4888-8888-888888888888';

  describe('ReviewImageEntity & RB-MG11', () => {
    it('[RB-MG11] ReviewImageEntity chấp nhận sortOrder = 0', () => {
      const entity = new ReviewImageEntity({
        reviewImageId: imageId,
        reviewId,
        imageUrl: 'https://example.com/img.png',
        sortOrder: 0,
      });

      assert.equal(entity.reviewImageId, imageId);
      assert.equal(entity.reviewId, reviewId);
      assert.equal(entity.sortOrder, 0);
    });

    it('[RB-MG11] ReviewImageEntity ném VALIDATION_FAILED khi sortOrder âm (< 0)', () => {
      assert.throws(
        () => {
          new ReviewImageEntity({
            reviewImageId: imageId,
            reviewId,
            imageUrl: 'https://example.com/img.png',
            sortOrder: -1,
          });
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[RB-MG11] ReviewImageEntity ném VALIDATION_FAILED khi sortOrder không nguyên', () => {
      assert.throws(
        () => {
          new ReviewImageEntity({
            reviewImageId: imageId,
            reviewId,
            imageUrl: 'https://example.com/img.png',
            sortOrder: 1.5,
          });
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('ReviewImageEntity ném VALIDATION_FAILED khi imageUrl để trống', () => {
      assert.throws(
        () => {
          new ReviewImageEntity({
            reviewImageId: imageId,
            reviewId,
            imageUrl: '   ',
            sortOrder: 1,
          });
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('Storage Path Generation & Validation', () => {
    it('[Canonical Path] generateReviewStoragePath sinh đúng cấu trúc users/{userId}/reviews/{reviewId}/{imageId}.webp', () => {
      const path = mediaService.generateReviewStoragePath(userId, reviewId, imageId, 'webp');
      assert.equal(path, `users/${userId}/reviews/${reviewId}/${imageId}.webp`);
    });

    it('[UUID Validation] generateReviewStoragePath ném ValidationError với UUID không hợp lệ', () => {
      assert.throws(
        () => {
          mediaService.generateReviewStoragePath('not-a-uuid', reviewId, imageId, 'jpg');
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[Extension Whitelist] chấp nhận các định dạng ảnh jpg, jpeg, png, webp', () => {
      const exts = ['jpg', 'jpeg', 'png', 'webp'];
      for (const ext of exts) {
        const path = mediaService.generateReviewStoragePath(userId, reviewId, imageId, ext);
        assert.equal(path, `users/${userId}/reviews/${reviewId}/${imageId}.${ext}`);
      }
    });

    it('[Extension Whitelist] từ chối extension không nằm trong whitelist (exe, gif, sh)', () => {
      assert.throws(
        () => {
          mediaService.generateReviewStoragePath(userId, reviewId, imageId, 'exe');
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );

      assert.throws(
        () => {
          mediaService.generateReviewStoragePath(userId, reviewId, imageId, 'sh');
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });
  });

  describe('Public URL Resolution & Image Metadata', () => {
    it('[Public URL Resolver] resolvePublicUrl ghép chính xác base URL cho relative storage path', () => {
      const relPath = `users/${userId}/reviews/${reviewId}/${imageId}.jpg`;
      const resolved = mediaService.resolvePublicUrl(relPath);
      assert.equal(
        resolved,
        `https://supabase.co/storage/v1/object/public/review-media/users/${userId}/reviews/${reviewId}/${imageId}.jpg`
      );
    });

    it('[Public URL Resolver] resolvePublicUrl giữ nguyên URL tuyệt đối', () => {
      const absoluteUrl = 'https://cdn.example.com/review1.jpg';
      assert.equal(mediaService.resolvePublicUrl(absoluteUrl), absoluteUrl);
    });

    it('validateReviewImageMetadata hợp lệ không ném lỗi và từ chối metadata sai sortOrder', () => {
      assert.doesNotThrow(() => {
        mediaService.validateReviewImageMetadata({
          imageUrl: 'valid.jpg',
          sortOrder: 0,
        });
      });

      assert.throws(() => {
        mediaService.validateReviewImageMetadata({
          imageUrl: 'valid.jpg',
          sortOrder: -1,
        });
      }, ValidationError);
    });
  });

  describe('Buyer Ownership & Path Validation on Images', () => {
    it('[Ownership Validation] validateBuyerImages chấp nhận URL tuyệt đối', () => {
      const res = mediaService.validateBuyerImages(userId, reviewId, ['https://cdn.example.com/r.jpg']);
      assert.deepEqual(res, ['https://cdn.example.com/r.jpg']);
    });

    it('[Ownership Validation] validateBuyerImages chấp nhận relative path đúng buyer và reviewId', () => {
      const path = `users/${userId}/reviews/${reviewId}/${imageId}.jpg`;
      const res = mediaService.validateBuyerImages(userId, reviewId, [path]);
      assert.deepEqual(res, [path]);
    });

    it('[Ownership Validation] validateBuyerImages từ chối relative path của buyer khác', () => {
      const foreignPath = `users/${otherUserId}/reviews/${reviewId}/${imageId}.jpg`;
      assert.throws(
        () => {
          mediaService.validateBuyerImages(userId, reviewId, [foreignPath]);
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[Ownership Validation] validateBuyerImages từ chối relative path sai reviewId', () => {
      const otherReviewId = '99999999-9999-4999-8999-999999999999';
      const wrongReviewPath = `users/${userId}/reviews/${otherReviewId}/${imageId}.jpg`;
      assert.throws(
        () => {
          mediaService.validateBuyerImages(userId, reviewId, [wrongReviewPath]);
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[Ownership Validation] validateBuyerImages từ chối path không hợp lệ hoặc sai bucket regex', () => {
      assert.throws(
        () => {
          mediaService.validateBuyerImages(userId, reviewId, ['random/path/image.jpg']);
        },
        (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
      );
    });

    it('[Null/Undefined] validateBuyerImages với images = undefined trả về undefined', () => {
      const res = mediaService.validateBuyerImages(userId, reviewId, undefined);
      assert.equal(res, undefined);
    });
  });
});
