export const STORAGE_BUCKETS = {
  PRODUCT_MEDIA: 'product-media',
  REVIEW_MEDIA: 'review-media',
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
export type AllowedImageExtension = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCT_IMAGE_PATH_REGEX = /^shops\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/products\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$/i;
const SHOP_LOGO_PATH_REGEX = /^shops\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/logo\.(jpg|jpeg|png|webp)$/i;
const REVIEW_IMAGE_PATH_REGEX = /^users\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/reviews\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$/i;

export interface ProductImagePathMetadata {
  type: 'product_image';
  shopId: string;
  productId: string;
  imageId: string;
  extension: AllowedImageExtension;
}

export interface ShopLogoPathMetadata {
  type: 'shop_logo';
  shopId: string;
  extension: AllowedImageExtension;
}

export interface ReviewImagePathMetadata {
  type: 'review_image';
  userId: string;
  reviewId: string;
  imageId: string;
  extension: AllowedImageExtension;
}

export type StoragePathMetadata =
  | ProductImagePathMetadata
  | ShopLogoPathMetadata
  | ReviewImagePathMetadata;

const sanitizeExt = (ext: string): AllowedImageExtension => {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(normalized as AllowedImageExtension)) {
    throw new Error(`Unsupported image extension: ${ext}`);
  }
  return normalized as AllowedImageExtension;
};

/**
 * Sinh đường dẫn ảnh sản phẩm: shops/{shopId}/products/{productId}/{imageId}.{ext}
 */
export function buildProductImagePath(
  shopId: string,
  productId: string,
  imageId: string,
  ext: string,
): string {
  if (!UUID_REGEX.test(shopId) || !UUID_REGEX.test(productId) || !UUID_REGEX.test(imageId)) {
    throw new Error('IDs must be valid UUIDs');
  }
  return `shops/${shopId}/products/${productId}/${imageId}.${sanitizeExt(ext)}`;
}

/**
 * Sinh đường dẫn logo shop: shops/{shopId}/logo.{ext}
 */
export function buildShopLogoPath(shopId: string, ext: string): string {
  if (!UUID_REGEX.test(shopId)) {
    throw new Error('shopId must be a valid UUID');
  }
  return `shops/${shopId}/logo.${sanitizeExt(ext)}`;
}

/**
 * Sinh đường dẫn ảnh review: users/{userId}/reviews/{reviewId}/{imageId}.{ext}
 */
export function buildReviewImagePath(
  userId: string,
  reviewId: string,
  imageId: string,
  ext: string,
): string {
  if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(reviewId) || !UUID_REGEX.test(imageId)) {
    throw new Error('IDs must be valid UUIDs');
  }
  return `users/${userId}/reviews/${reviewId}/${imageId}.${sanitizeExt(ext)}`;
}

/**
 * Kiểm tra tính hợp lệ của đường dẫn lưu trữ theo từng bucket.
 */
export function validateStoragePath(bucket: string, path: string): boolean {
  if (path.includes('..') || path.includes('//')) return false;

  if (bucket === STORAGE_BUCKETS.PRODUCT_MEDIA) {
    return PRODUCT_IMAGE_PATH_REGEX.test(path) || SHOP_LOGO_PATH_REGEX.test(path);
  }

  if (bucket === STORAGE_BUCKETS.REVIEW_MEDIA) {
    return REVIEW_IMAGE_PATH_REGEX.test(path);
  }

  return false;
}

/**
 * Phân tích đường dẫn lưu trữ thành đối tượng metadata có cấu trúc.
 */
export function parseStoragePath(path: string): StoragePathMetadata | null {
  const prodMatch = path.match(PRODUCT_IMAGE_PATH_REGEX);
  if (prodMatch) {
    return {
      type: 'product_image',
      shopId: prodMatch[1],
      productId: prodMatch[2],
      imageId: prodMatch[3],
      extension: prodMatch[4] as AllowedImageExtension,
    };
  }

  const logoMatch = path.match(SHOP_LOGO_PATH_REGEX);
  if (logoMatch) {
    return {
      type: 'shop_logo',
      shopId: logoMatch[1],
      extension: logoMatch[2] as AllowedImageExtension,
    };
  }

  const reviewMatch = path.match(REVIEW_IMAGE_PATH_REGEX);
  if (reviewMatch) {
    return {
      type: 'review_image',
      userId: reviewMatch[1],
      reviewId: reviewMatch[2],
      imageId: reviewMatch[3],
      extension: reviewMatch[4] as AllowedImageExtension,
    };
  }

  return null;
}
