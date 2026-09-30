import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildSuccessEnvelope } from '../envelope.ts';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import { STORAGE_BUCKETS } from '../../../../db/storage.ts';
import { attachFinalizedMedia, markMediaFinalized, registerPresignedMedia } from '../../../../db/media-lifecycle.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

function asyncRoute(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function context(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  return req.context;
}

function guards(auth: RequestHandler | undefined, ...roles: Role[]): RequestHandler[] {
  return auth ? [auth, requireRole(...roles)] : [requireRole(...roles)];
}

function requireRole(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    try {
      const requestContext = context(req);
      if (!roles.includes(requestContext.role as Role)) {
        throw new ForbiddenError('ROLE_REQUIRED', `Required role: ${roles.join(' or ')}`);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requestId(req: Request): string {
  return req.requestId ?? 'req_unknown';
}

export class MediaValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, 'VALIDATION_FAILED', message, details);
  }
}

export class MediaExpiredError extends AppError {
  constructor(message = 'Presigned upload has expired. Please request a new presign URL.') {
    super(410, 'MEDIA_EXPIRED', message);
  }
}

export class MediaAlreadyAttachedError extends AppError {
  constructor(message = 'Cannot delete media that is already attached to a product or review.') {
    super(409, 'MEDIA_ALREADY_ATTACHED', message);
  }
}

export class ShopNotActiveError extends AppError {
  constructor(message = 'Shop must be ACTIVE to upload product media.') {
    super(403, 'SHOP_NOT_ACTIVE', message);
  }
}

export interface MediaRuntimeDependencies {
  pool: Pool;
  storage: SupabaseClient;
}

export function mapPurposeToDb(purpose: string): 'PRODUCT' | 'REVIEW' {
  if (purpose === 'product_image' || purpose === 'PRODUCT' || purpose === 'product') {
    return 'PRODUCT';
  }
  if (purpose === 'review_image' || purpose === 'REVIEW' || purpose === 'review') {
    return 'REVIEW';
  }
  throw new MediaValidationError(`Invalid purpose: ${purpose}. Allowed: product_image, review_image`, { field: 'purpose' });
}

/**
 * Detect MIME type using magic bytes (B-102)
 * JPEG: FF D8 FF
 * PNG: 89 50 4E 47 (first 4 bytes)
 * WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
 */
export function detectMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11 in a 12-byte buffer)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

interface UploadRecord {
  mediaId: string;
  userId: string;
  shopId?: string;
  filename: string;
  storagePath: string;
  bucket: string;
  status: 'PENDING' | 'FINALIZED';
  attached: boolean;
  createdAt: number;
}

const uploadsStore = new Map<string, UploadRecord>();

export function createMediaRouter(auth?: RequestHandler, runtime?: MediaRuntimeDependencies): Router {
  const router = Router();

  // POST /media/uploads/presign
  router.post(
    '/media/uploads/presign',
    ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const body = (req.body ?? {}) as Record<string, unknown>;

      const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
      const contentType = typeof body.content_type === 'string' ? body.content_type.toLowerCase().trim() : '';
      const purpose = typeof body.purpose === 'string' ? body.purpose : 'product_image';
      const dbPurpose = mapPurposeToDb(purpose);

      if (!filename) {
        throw new MediaValidationError('filename is required', { field: 'filename' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        throw new MediaValidationError(
          'Định dạng không được hỗ trợ. Chỉ chấp nhận image/jpeg, image/png hoặc image/webp',
          { field: 'content_type' },
        );
      }

      if (dbPurpose === 'PRODUCT') {
        if (ctx.shop_status && ctx.shop_status !== 'ACTIVE') {
          throw new ShopNotActiveError();
        }
      }

      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
      const mediaId = crypto.randomUUID();

      let storagePath: string;
      let bucket: string;

      if (runtime && dbPurpose === 'PRODUCT') {
        const productId = typeof body.product_id === 'string' ? body.product_id : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
          throw new MediaValidationError('product_id is required for product media uploads', { field: 'product_id' });
        }
        bucket = STORAGE_BUCKETS.PRODUCT_MEDIA;
        storagePath = `shops/${ctx.shop_id}/products/${productId}/${mediaId}.${ext}`;
      } else if (dbPurpose === 'REVIEW') {
        bucket = STORAGE_BUCKETS.REVIEW_MEDIA;
        storagePath = `users/${ctx.user_id}/reviews/temp/${mediaId}.${ext}`;
      } else {
        bucket = STORAGE_BUCKETS.PRODUCT_MEDIA;
        const shopId = ctx.shop_id || '00000000-0000-0000-0000-000000000001';
        storagePath = `shops/${shopId}/products/temp/${mediaId}.${ext}`;
      }

      if (runtime) {
        if (dbPurpose !== 'PRODUCT') {
          throw new MediaValidationError('Review media upload is not available in this runtime', { field: 'purpose' });
        }
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await registerPresignedMedia(runtime.pool, {
          mediaId,
          ownerId: ctx.user_id,
          purpose: 'PRODUCT',
          bucketId: STORAGE_BUCKETS.PRODUCT_MEDIA,
          objectPath: storagePath,
          expiresAt,
        });
        const signed = await runtime.storage.storage.from(bucket).createSignedUploadUrl(storagePath, { upsert: false });
        if (signed.error) {
          await runtime.pool.query("DELETE FROM media_uploads WHERE media_id=$1 AND status='PRESIGNED'", [mediaId]);
          throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Could not create a Supabase Storage upload URL');
        }
        res.status(201).json(buildSuccessEnvelope({
          media_id: mediaId,
          upload_url: signed.data.signedUrl,
          storage_path: storagePath,
          expires_in_seconds: 600,
        }, requestId(req)));
        return;
      }

      uploadsStore.set(mediaId, {
        mediaId,
        userId: ctx.user_id,
        shopId: ctx.shop_id,
        filename,
        storagePath,
        bucket,
        status: 'PENDING',
        attached: false,
        createdAt: Date.now(),
      });

      const uploadUrl = `https://supabase.co/storage/v1/object/${bucket}/${storagePath}`;

      res.status(201).json(
        buildSuccessEnvelope(
          {
            media_id: mediaId,
            upload_url: uploadUrl,
            storage_path: storagePath,
            expires_in_seconds: 600,
          },
          requestId(req),
        ),
      );
    }),
  );

  // POST /media/uploads/:media_id/finalize
  router.post(
    '/media/uploads/:media_id/finalize',
    ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const mediaId = req.params.media_id;
      const body = (req.body ?? {}) as Record<string, unknown>;

      if (runtime) {
        const found = await runtime.pool.query<{
          owner_id: string; purpose: string; bucket_id: string; object_path: string; status: string; expires_at: Date;
        }>('SELECT owner_id,purpose,bucket_id,object_path,status,expires_at FROM media_uploads WHERE media_id=$1', [mediaId]);
        const record = found.rows[0];
        if (!record) throw new NotFoundError(`Upload ${mediaId} not found`);
        if (record.owner_id !== ctx.user_id && ctx.role !== 'ADMIN') {
          throw new ForbiddenError('FORBIDDEN', 'Cannot finalize media belonging to another user');
        }
        if (record.status === 'FINALIZED') {
          const publicUrl = runtime.storage.storage.from(record.bucket_id).getPublicUrl(record.object_path).data.publicUrl;
          res.json(buildSuccessEnvelope({ media_id: mediaId, public_url: publicUrl, storage_path: record.object_path, status: 'FINALIZED' }, requestId(req)));
          return;
        }
        if (record.status !== 'PRESIGNED' || new Date(record.expires_at).getTime() <= Date.now()) {
          throw new MediaExpiredError();
        }
        const downloaded = await runtime.storage.storage.from(record.bucket_id).download(record.object_path);
        if (downloaded.error || !downloaded.data) {
          throw new AppError(422, 'VALIDATION_FAILED', 'Uploaded object could not be read from Storage');
        }
        const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
        const detected = detectMagicBytes(Buffer.from(bytes));
        if (!detected || bytes.length > 5 * 1024 * 1024) {
          throw new MediaValidationError('Uploaded file is not a supported JPEG, PNG, or WebP image under 5 MB', { field: 'file' });
        }
        const extension = record.object_path.split('.').pop()?.toLowerCase();
        const expectedExtension = detected === 'image/jpeg' ? ['jpg', 'jpeg'] : detected === 'image/png' ? ['png'] : ['webp'];
        if (!extension || !expectedExtension.includes(extension)) {
          throw new MediaValidationError('Uploaded image content does not match its file extension', { field: 'file' });
        }
        await markMediaFinalized(runtime.pool, mediaId, bytes);
        const publicUrl = runtime.storage.storage.from(record.bucket_id).getPublicUrl(record.object_path).data.publicUrl;
        res.json(buildSuccessEnvelope({ media_id: mediaId, public_url: publicUrl, storage_path: record.object_path, status: 'FINALIZED' }, requestId(req)));
        return;
      }

      const record = uploadsStore.get(mediaId);
      if (!record) {
        throw new NotFoundError(`Upload ${mediaId} not found`);
      }

      if (record.userId !== ctx.user_id && ctx.role !== 'ADMIN') {
        throw new ForbiddenError('FORBIDDEN', 'Cannot finalize media belonging to another user');
      }

      // Check expiry (TTL: 600s / 10 minutes)
      if (Date.now() - record.createdAt > 600 * 1000) {
        throw new MediaExpiredError('Presigned upload has expired. Please request a new presign URL.');
      }

      const publicUrl = `https://supabase.co/storage/v1/object/public/${record.bucket}/${record.storagePath}`;

      // Idempotency: if already finalized, return existing record
      if (record.status === 'FINALIZED') {
        res.json(
          buildSuccessEnvelope(
            {
              media_id: mediaId,
              public_url: publicUrl,
              storage_path: record.storagePath,
              status: 'FINALIZED',
            },
            requestId(req),
          ),
        );
        return;
      }

      // Security: in production, client-sent magic bytes in request body is forbidden
      if (process.env.NODE_ENV === 'production' && (body.magic_bytes || body.data_base64)) {
        throw new MediaValidationError(
          'Client magic_bytes is disabled in production. Media must be inspected via storage.',
          { field: 'magic_bytes' },
        );
      }

      // Verify magic bytes (B-102)
      let buffer: Buffer | null = null;
      if (typeof body.magic_bytes === 'string') {
        const hex = body.magic_bytes.replace(/\s+/g, '');
        if (/^[0-9a-fA-F]+$/.test(hex)) {
          buffer = Buffer.from(hex, 'hex');
        } else {
          buffer = Buffer.from(body.magic_bytes, 'base64');
        }
      } else if (typeof body.data_base64 === 'string') {
        buffer = Buffer.from(body.data_base64, 'base64');
      }

      if (!buffer) {
        throw new MediaValidationError(
          'Vui lòng cung cấp magic_bytes để hoàn tất tải lên.',
          { field: 'magic_bytes' },
        );
      }

      const detected = detectMagicBytes(buffer);
      if (!detected) {
        throw new MediaValidationError(
          'Sai magic bytes bị từ chối: Định dạng file không hợp lệ hoặc bị giả mạo.',
          { field: 'magic_bytes' },
        );
      }

      record.status = 'FINALIZED';
      uploadsStore.set(mediaId, record);

      res.json(
        buildSuccessEnvelope(
          {
            media_id: mediaId,
            public_url: publicUrl,
            storage_path: record.storagePath,
            status: 'FINALIZED',
          },
          requestId(req),
        ),
      );
    }),
  );

  // PATCH /media/uploads/:media_id/attach
  router.patch(
    '/media/uploads/:media_id/attach',
    ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const mediaId = req.params.media_id;

      if (runtime) {
        const productId = typeof req.body?.product_id === 'string' ? req.body.product_id : '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
          throw new MediaValidationError('product_id is required to attach product media', { field: 'product_id' });
        }
        if (!ctx.shop_id || (ctx.role !== 'SELLER' && ctx.role !== 'ADMIN')) {
          throw new ForbiddenError('ROLE_REQUIRED', 'Seller shop is required to attach product media');
        }
        const product = await runtime.pool.query(
          `SELECT p.product_id FROM products p JOIN shops s ON s.shop_id=p.shop_id
           WHERE p.product_id=$1 AND p.shop_id=$2 AND s.owner_id=$3 AND s.status='ACTIVE'`,
          [productId, ctx.shop_id, ctx.user_id],
        );
        if (product.rowCount !== 1) throw new NotFoundError('Product not found in seller shop');
        await attachFinalizedMedia(runtime.pool, {
          mediaId,
          ownerId: ctx.user_id,
          purpose: 'PRODUCT',
          resource: { kind: 'PRODUCT', shopId: ctx.shop_id, productId },
        });
        res.json(buildSuccessEnvelope({ media_id: mediaId, attached: true }, requestId(req)));
        return;
      }

      const record = uploadsStore.get(mediaId);
      if (!record) {
        throw new NotFoundError(`Upload ${mediaId} not found`);
      }
      if (record.userId !== ctx.user_id && ctx.role !== 'ADMIN') {
        throw new ForbiddenError('FORBIDDEN', 'Cannot attach media belonging to another user');
      }

      record.attached = true;
      uploadsStore.set(mediaId, record);

      res.json(
        buildSuccessEnvelope(
          {
            media_id: mediaId,
            attached: true,
          },
          requestId(req),
        ),
      );
    }),
  );

  // DELETE /media/uploads/:media_id
  router.delete(
    '/media/uploads/:media_id',
    ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const mediaId = req.params.media_id;

      if (runtime) {
        const found = await runtime.pool.query<{
          owner_id: string; bucket_id: string; object_path: string; status: string;
        }>('SELECT owner_id,bucket_id,object_path,status FROM media_uploads WHERE media_id=$1', [mediaId]);
        const record = found.rows[0];
        if (record) {
          if (record.owner_id !== ctx.user_id && ctx.role !== 'ADMIN') {
            throw new ForbiddenError('FORBIDDEN', 'Cannot delete media belonging to another user');
          }
          if (record.status === 'ATTACHED') throw new MediaAlreadyAttachedError();
          const removed = await runtime.storage.storage.from(record.bucket_id).remove([record.object_path]);
          if (removed.error) throw new AppError(503, 'DEPENDENCY_UNAVAILABLE', 'Could not remove the uploaded object from Storage');
          if (record.status === 'PRESIGNED') {
            await runtime.pool.query("DELETE FROM media_uploads WHERE media_id=$1 AND status='PRESIGNED'", [mediaId]);
          } else if (record.status !== 'DELETED') {
            await runtime.pool.query(
              "UPDATE media_uploads SET status='DELETED',deleted_at=now(),updated_at=now() WHERE media_id=$1 AND status IN ('FINALIZED','DELETE_PENDING') AND attached_at IS NULL",
              [mediaId],
            );
          }
        }
        res.status(204).send();
        return;
      }

      const record = uploadsStore.get(mediaId);
      if (record) {
        if (record.userId !== ctx.user_id && ctx.role !== 'ADMIN') {
          throw new ForbiddenError('FORBIDDEN', 'Cannot delete media belonging to another user');
        }
        if (record.attached) {
          throw new MediaAlreadyAttachedError();
        }
        uploadsStore.delete(mediaId);
      }

      res.status(204).send();
    }),
  );

  return router;
}
