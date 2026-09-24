import {
  buildReviewImagePath,
  parseStoragePath,
} from '../../../../db/storage.ts';
import { ValidationError } from '../domain/errors.ts';
import { ReviewImageEntity } from '../domain/media.ts';
import type { UUID } from '../domain/types.ts';

/**
 * ReviewMediaService
 * Quản lý logic đường dẫn lưu trữ (Storage Path) và chuẩn hóa media cho Review Domain.
 * Đảm bảo tương thích hoàn toàn với Supabase Storage RLS policy do Người 2 thiết lập:
 * users/{userId}/reviews/{reviewId}/{imageId}.{ext}
 */
export class ReviewMediaService {
  private readonly defaultBucketUrl: string;

  constructor(defaultBucketUrl = 'https://supabase.co/storage/v1/object/public/review-media') {
    this.defaultBucketUrl = defaultBucketUrl.replace(/\/+$/, '');
  }

  generateReviewStoragePath(
    userId: UUID,
    reviewId: UUID,
    imageId: UUID,
    extension: string = 'jpg'
  ): string {
    try {
      return buildReviewImagePath(userId, reviewId, imageId, extension);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid storage path parameters';
      throw new ValidationError(message);
    }
  }

  resolvePublicUrl(storagePathOrUrl: string, bucketBaseUrl?: string): string {
    if (!storagePathOrUrl) return '';
    if (storagePathOrUrl.startsWith('http://') || storagePathOrUrl.startsWith('https://')) {
      return storagePathOrUrl;
    }
    const base = (bucketBaseUrl ?? this.defaultBucketUrl).replace(/\/+$/, '');
    const cleanPath = storagePathOrUrl.replace(/^\/+/, '');
    return `${base}/${cleanPath}`;
  }

  validateReviewImageMetadata(image: { imageUrl: string; sortOrder: number }): void {
    new ReviewImageEntity({
      reviewImageId: '00000000-0000-0000-0000-000000000000',
      reviewId: '00000000-0000-0000-0000-000000000000',
      imageUrl: image.imageUrl,
      sortOrder: image.sortOrder,
    });
  }

  validateBuyerImages(
    buyerId: UUID,
    reviewId?: UUID,
    images?: string[]
  ): string[] | undefined {
    if (!images) {
      return undefined;
    }

    for (const img of images) {
      if (!img || typeof img !== 'string' || img.trim().length === 0) {
        throw new ValidationError('Đường dẫn ảnh đánh giá không được để trống.');
      }
      const trimmed = img.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        // Public URL tuyệt đối hợp lệ
        continue;
      }

      // Kiểm tra storage path canonical
      const parsed = parseStoragePath(trimmed);
      if (!parsed || parsed.type !== 'review_image') {
        throw new ValidationError('Đường dẫn ảnh đánh giá không hợp lệ theo cấu trúc lưu trữ (QD14, auth-rbac-rls).');
      }

      if (parsed.userId !== buyerId) {
        throw new ValidationError(
          'Ảnh đánh giá phải thuộc về người mua sở hữu đơn hàng (auth-rbac-rls §4).',
          {
            expectedUserId: buyerId,
            actualUserId: parsed.userId,
          }
        );
      }

      if (reviewId !== undefined && parsed.reviewId !== reviewId) {
        throw new ValidationError(
          'Ảnh đánh giá không khớp với mã bài đánh giá tương ứng.',
          {
            expectedReviewId: reviewId,
            actualReviewId: parsed.reviewId,
          }
        );
      }
    }

    return images;
  }
}
