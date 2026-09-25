import type { UUID, ProductImage } from './types.ts';
import { ValidationError } from './errors.ts';

export interface ProductImageParams {
  imageId: UUID;
  productId: UUID;
  imageUrl: string;
  sortOrder: number;
}

/**
 * ProductImageEntity
 * Đại diện cho ảnh sản phẩm trong Catalog Domain, thực thi quy tắc RB-MG11.
 */
export class ProductImageEntity implements ProductImage {
  public readonly imageId: UUID;
  public readonly productId: UUID;
  public imageUrl: string;
  public sortOrder: number;

  constructor(params: ProductImageParams) {
    if (!params.imageId || typeof params.imageId !== 'string') {
      throw new ValidationError('Mã định danh ảnh (imageId) không hợp lệ.');
    }
    if (!params.productId || typeof params.productId !== 'string') {
      throw new ValidationError('Mã sản phẩm (productId) không hợp lệ.');
    }
    if (!params.imageUrl || typeof params.imageUrl !== 'string' || params.imageUrl.trim().length === 0) {
      throw new ValidationError('Đường dẫn ảnh (imageUrl) không được để trống.');
    }

    // RB-MG11: Thứ tự ảnh (sortOrder) >= 0, số nguyên, số âm bị chặn
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

    this.imageId = params.imageId;
    this.productId = params.productId;
    this.imageUrl = params.imageUrl.trim();
    this.sortOrder = params.sortOrder;
  }
}

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type AllowedImageExtension = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

function sanitizeExtension(extension?: string, defaultExt: AllowedImageExtension = 'jpg'): AllowedImageExtension {
  if (!extension) return defaultExt;
  const cleanExt = extension.replace(/^\./, '').toLowerCase().trim();
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(cleanExt as AllowedImageExtension)) {
    throw new ValidationError(
      `Đuôi mở rộng hình ảnh không hợp lệ: '${extension}'. Chỉ chấp nhận: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}.`
    );
  }
  return cleanExt as AllowedImageExtension;
}

/**
 * Khóa chuẩn cấu trúc Media Storage Path cho Catalog theo tài liệu kiến trúc.
 * Dùng để Người 2 cấu hình Storage Policy và RLS trên Supabase Storage bucket.
 */
export function buildProductImagePath(
  shopId: UUID,
  productId: UUID,
  imageId: UUID,
  extension: string = 'jpg'
): string {
  const cleanExt = sanitizeExtension(extension, 'jpg');
  return `shops/${shopId}/products/${productId}/${imageId}.${cleanExt}`;
}

export function buildShopLogoPath(
  shopId: UUID,
  extension: string = 'png'
): string {
  const cleanExt = sanitizeExtension(extension, 'png');
  return `shops/${shopId}/logo.${cleanExt}`;
}
