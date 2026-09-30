import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import { STORAGE_BUCKETS } from '../../../../db/storage.ts';

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

/**
 * Detect MIME type using magic bytes (B-102)
 */
export function detectMagicBytes(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (!buffer || buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF .... WEBP
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

export function createMediaRouter(auth?: RequestHandler): Router {
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

      if (!filename) {
        throw new ValidationFailedError('filename is required', { field: 'filename' });
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(contentType)) {
        throw new ValidationFailedError(
          'Định dạng không được hỗ trợ. Chỉ chấp nhận image/jpeg, image/png hoặc image/webp',
          { field: 'content_type' },
        );
      }

      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
      const mediaId = crypto.randomUUID();

      let storagePath: string;
      let bucket: string;

      if (purpose === 'review_image') {
        bucket = STORAGE_BUCKETS.REVIEW_MEDIA;
        storagePath = `users/${ctx.user_id}/reviews/temp/${mediaId}.${ext}`;
      } else {
        bucket = STORAGE_BUCKETS.PRODUCT_MEDIA;
        const shopId = ctx.shop_id || '00000000-0000-0000-0000-000000000001';
        storagePath = `shops/${shopId}/products/temp/${mediaId}.${ext}`;
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

      const record = uploadsStore.get(mediaId);
      if (!record) {
        throw new NotFoundError(`Upload ${mediaId} not found`);
      }

      if (record.userId !== ctx.user_id && ctx.role !== 'ADMIN') {
        throw new ForbiddenError('FORBIDDEN', 'Cannot finalize media belonging to another user');
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

      if (buffer) {
        const detected = detectMagicBytes(buffer);
        if (!detected) {
          throw new ValidationFailedError(
            'Sai magic bytes bị từ chối: Định dạng file không hợp lệ hoặc bị giả mạo.',
            { field: 'magic_bytes' },
          );
        }
      }

      record.status = 'FINALIZED';
      uploadsStore.set(mediaId, record);

      const publicUrl = `https://supabase.co/storage/v1/object/public/${record.bucket}/${record.storagePath}`;

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

  // DELETE /media/uploads/:media_id
  router.delete(
    '/media/uploads/:media_id',
    ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const mediaId = req.params.media_id;

      const record = uploadsStore.get(mediaId);
      if (record) {
        if (record.userId !== ctx.user_id && ctx.role !== 'ADMIN') {
          throw new ForbiddenError('FORBIDDEN', 'Cannot delete media belonging to another user');
        }
        if (record.attached) {
          throw new ValidationFailedError('Cannot delete attached media');
        }
        uploadsStore.delete(mediaId);
      }

      res.status(204).send();
    }),
  );

  return router;
}
