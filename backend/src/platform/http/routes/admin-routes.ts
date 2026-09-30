import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { requireRole } from '../middlewares/rbac.ts';
import { NotFoundError, UnauthorizedError } from '../../errors/app-error.ts';
import type { IModerationService } from '../../../modules/moderation/domain/moderation.types.ts';
import type { RequestContext } from '../../context/request-context.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

function asyncRoute(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

function guards(auth: RequestHandler | undefined, ...roles: ('BUYER' | 'SELLER' | 'ADMIN')[]): RequestHandler[] {
  return auth ? [auth, requireRole(...roles)] : [requireRole(...roles)];
}

function context(req: Request): RequestContext {
  if (!req.context) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required.');
  }
  return req.context;
}

function requestId(req: Request): string {
  return req.requestId ?? 'req_unknown';
}

function implementation<T extends (...args: never[]) => Promise<unknown>>(method: T | undefined, receiver?: unknown): T {
  if (method) return receiver === undefined ? method : (method.bind(receiver) as T);
  return (async () => {
    throw new NotFoundError('Admin moderation handler is not configured');
  }) as unknown as T;
}

export function createAdminRouter(moderation?: IModerationService, auth?: RequestHandler): Router {
  const router = Router();

  // GET /admin/users
  router.get(
    '/admin/users',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const { role, status, search } = req.query;
      const service = implementation(moderation?.listUsers, moderation);
      const users = await service({
        role: typeof role === 'string' ? role : undefined,
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json(buildSuccessEnvelope(users, requestId(req)));
    })
  );

  // POST /admin/users/:id/lock
  router.post(
    '/admin/users/:id/lock',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' ? body.reason : '';

      const service = implementation(moderation?.moderateTarget, moderation);
      const result = await service({
        admin_id: ctx.user_id,
        target_type: 'USER',
        target_id: targetId,
        action: 'LOCK',
        reason,
      });

      res.json(buildSuccessEnvelope(result, requestId(req)));
    })
  );

  // POST /admin/users/:id/unlock
  router.post(
    '/admin/users/:id/unlock',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' ? body.reason : '';

      const service = implementation(moderation?.moderateTarget, moderation);
      const result = await service({
        admin_id: ctx.user_id,
        target_type: 'USER',
        target_id: targetId,
        action: 'UNLOCK',
        reason,
      });

      res.json(buildSuccessEnvelope(result, requestId(req)));
    })
  );

  // GET /admin/shops
  router.get(
    '/admin/shops',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const { status, search } = req.query;
      const service = implementation(moderation?.listShops, moderation);
      const shops = await service({
        status: typeof status === 'string' ? status : undefined,
        search: typeof search === 'string' ? search : undefined,
      });
      res.json(buildSuccessEnvelope(shops, requestId(req)));
    })
  );

  // POST /admin/shops/:id/approve
  router.post(
    '/admin/shops/:id/approve',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Shop approved by admin';

      if (moderation?.approveShop) {
        const result = await moderation.approveShop(ctx.user_id, targetId, reason);
        res.json(buildSuccessEnvelope(result, requestId(req)));
      } else {
        const service = implementation(moderation?.moderateTarget, moderation);
        const result = await service({
          admin_id: ctx.user_id,
          target_type: 'SHOP',
          target_id: targetId,
          action: 'APPROVE',
          reason,
        });
        res.json(buildSuccessEnvelope(result, requestId(req)));
      }
    })
  );

  // POST /admin/shops/:id/lock
  router.post(
    '/admin/shops/:id/lock',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' ? body.reason : '';

      if (moderation?.lockShop) {
        const result = await moderation.lockShop(ctx.user_id, targetId, reason);
        res.json(buildSuccessEnvelope(result, requestId(req)));
      } else {
        const service = implementation(moderation?.moderateTarget, moderation);
        const result = await service({
          admin_id: ctx.user_id,
          target_type: 'SHOP',
          target_id: targetId,
          action: 'LOCK',
          reason,
        });
        res.json(buildSuccessEnvelope(result, requestId(req)));
      }
    })
  );

  // POST /admin/shops/:id/unlock
  router.post(
    '/admin/shops/:id/unlock',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const ctx = context(req);
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'Shop unlocked by admin';

      if (moderation?.unlockShop) {
        const result = await moderation.unlockShop(ctx.user_id, targetId, reason);
        res.json(buildSuccessEnvelope(result, requestId(req)));
      } else {
        const service = implementation(moderation?.moderateTarget, moderation);
        const result = await service({
          admin_id: ctx.user_id,
          target_type: 'SHOP',
          target_id: targetId,
          action: 'UNLOCK',
          reason,
        });
        res.json(buildSuccessEnvelope(result, requestId(req)));
      }
    })
  );

  return router;
}
