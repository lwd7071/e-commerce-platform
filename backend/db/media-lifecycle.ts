import { parseStoragePath, validateStoragePath } from './storage.js';

type LifecycleQueryable = {
  query(text: string, values?: unknown[]): Promise<{ rowCount: number | null; rows?: Array<Record<string, unknown>> }>;
};

export type MediaPurpose = 'PRODUCT' | 'REVIEW';
export type MediaBucket = 'product-media' | 'review-media';
export const MAX_MEDIA_PRESIGN_TTL_MS = 10 * 60_000;
export const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;

export function detectImageMimeFromMagicBytes(bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (bytes.length > MAX_MEDIA_SIZE_BYTES) throw new Error('media exceeds the 5 MB upload limit');
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  throw new Error('media magic bytes do not match JPEG, PNG, or WebP');
}

const isValidPurposeBucket = (purpose: MediaPurpose, bucketId: MediaBucket): boolean =>
  (purpose === 'PRODUCT' && bucketId === 'product-media')
  || (purpose === 'REVIEW' && bucketId === 'review-media');

export async function registerPresignedMedia(
  client: LifecycleQueryable,
  media: {
    mediaId: string;
    ownerId: string;
    purpose: MediaPurpose;
    bucketId: MediaBucket;
    objectPath: string;
    expiresAt: Date;
  },
): Promise<void> {
  const pathPurposeMatches = media.purpose === 'PRODUCT'
    ? media.objectPath.startsWith('shops/')
    : media.objectPath.startsWith('users/');
  const pathMetadata = parseStoragePath(media.objectPath);
  if (!isValidPurposeBucket(media.purpose, media.bucketId)
    || !pathPurposeMatches
    || !validateStoragePath(media.bucketId, media.objectPath)
    || (media.purpose === 'PRODUCT' && pathMetadata?.type !== 'product_image')
    || (media.purpose === 'REVIEW' && (pathMetadata?.type !== 'review_image' || pathMetadata.userId !== media.ownerId))) {
    throw new Error(`invalid ${media.purpose.toLowerCase()} media path`);
  }
  const now = Date.now();
  if (!Number.isFinite(media.expiresAt.getTime()) || media.expiresAt.getTime() <= now) {
    throw new Error('media presigned expiry must be in the future');
  }
  if (media.expiresAt.getTime() > now + MAX_MEDIA_PRESIGN_TTL_MS) {
    throw new Error('media presigned expiry cannot exceed 10 minutes');
  }
  if (pathMetadata?.type === 'product_image') {
    const shop = await client.query('SELECT owner_id FROM shops WHERE shop_id=$1 AND status=\'ACTIVE\'', [pathMetadata.shopId]);
    if (shop.rows?.[0]?.owner_id !== media.ownerId) throw new Error('product media shop is not owned by this user');
  }
  const result = await client.query(`
    INSERT INTO media_uploads(media_id,owner_id,purpose,bucket_id,object_path,status,expires_at)
    VALUES($1,$2,$3,$4,$5,'PRESIGNED',$6)
  `, [media.mediaId, media.ownerId, media.purpose, media.bucketId, media.objectPath, media.expiresAt]);
  if (result.rowCount !== 1) throw new Error('could not register presigned media');
}

/** Detect bytes server-side; never trust the client Content-Type header for finalization. */
export async function markMediaFinalized(client: LifecycleQueryable, mediaId: string, uploadedBytes: Uint8Array): Promise<void> {
  detectImageMimeFromMagicBytes(uploadedBytes);
  const result = await client.query(`
    UPDATE media_uploads
    SET status='FINALIZED', finalized_at=now(), updated_at=now(), cleanup_error=NULL
    WHERE media_id=$1 AND status='PRESIGNED' AND expires_at > now()
  `, [mediaId]);
  if (result.rowCount !== 1) throw new Error('media is not presigned or its upload has expired');
}

/**
 * Run in the same database transaction as inserting the owning product/review image.
 * The status predicate serializes against cleanup's FINALIZED -> DELETE_PENDING claim.
 */
export async function attachFinalizedMedia(
  client: LifecycleQueryable,
  media: {
    mediaId: string;
    ownerId: string;
    purpose: MediaPurpose;
    resource: { kind: 'PRODUCT'; shopId: string; productId: string } | { kind: 'REVIEW'; reviewId: string };
  },
): Promise<void> {
  const expectedPurpose = media.resource.kind;
  if (media.purpose !== expectedPurpose) throw new Error('media purpose does not match attachment resource');
  const objectPathPrefix = media.resource.kind === 'PRODUCT'
    ? `shops/${media.resource.shopId}/products/${media.resource.productId}/`
    : `users/${media.ownerId}/reviews/${media.resource.reviewId}/`;
  const result = await client.query(`
    UPDATE media_uploads
    SET status='ATTACHED', attached_at=now(), updated_at=now()
    WHERE media_id=$1 AND owner_id=$2 AND purpose=$3
      AND status='FINALIZED' AND attached_at IS NULL AND deleted_at IS NULL
      AND object_path LIKE $4
  `, [media.mediaId, media.ownerId, media.purpose, `${objectPathPrefix}%`]);
  if (result.rowCount !== 1) throw new Error('media is not finalized, owned by this user, or already claimed for cleanup');
}
