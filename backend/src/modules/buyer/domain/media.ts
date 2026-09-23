import type { UUID, ReviewImage } from './types.ts';
import { ValidationError } from './errors.ts';

export interface ReviewImageParams {
  reviewImageId: UUID;
  reviewId: UUID;
  imageUrl: string;
  sortOrder: number;
}

/**
 * ReviewImageEntity
 * Đại diện cho thực thể ảnh đánh giá trong Buyer Domain.
 * Thực thi quy tắc [RB-MG11]: Thứ tự ảnh (sort_order) >= 0, số nguyên, không âm.
 */
export class ReviewImageEntity implements ReviewImage {
  public readonly reviewImageId: UUID;
  public readonly reviewId: UUID;
  public readonly imageUrl: string;
  public readonly sortOrder: number;

  constructor(params: ReviewImageParams) {
    if (!params.imageUrl || typeof params.imageUrl !== 'string' || params.imageUrl.trim().length === 0) {
      throw new ValidationError('Đường dẫn ảnh (imageUrl) không được để trống.');
    }

    // [RB-MG11] sortOrder phải là số nguyên không âm
    if (
      typeof params.sortOrder !== 'number' ||
      !Number.isInteger(params.sortOrder) ||
      params.sortOrder < 0
    ) {
      throw new ValidationError(
        'Thứ tự ảnh (sortOrder) phải là số nguyên không âm (RB-MG11).',
        { sortOrder: params.sortOrder }
      );
    }

    this.reviewImageId = params.reviewImageId;
    this.reviewId = params.reviewId;
    this.imageUrl = params.imageUrl.trim();
    this.sortOrder = params.sortOrder;
  }
}
