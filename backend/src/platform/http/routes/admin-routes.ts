import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildPaginatedEnvelope, buildSuccessEnvelope } from '../envelope.ts';
import { requireRole } from '../middlewares/rbac.ts';
import { NotFoundError, ReasonRequiredError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { IModerationService } from '../../../modules/moderation/domain/moderation.types.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { CatalogHttpApplication } from './t1-routes.ts';
import type { AdminReadService } from '../../../modules/moderation/services/admin-read.service.ts';
import type { AdminVoucherService } from '../../../modules/voucher/services/admin-voucher.service.ts';
import type { AdminNotificationCampaignService } from '../../../modules/moderation/services/admin-notification-campaign.service.ts';
import type { OrderQueryService } from '../../../modules/order/services/order-query.service.ts';

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

export function createAdminRouter(moderation?: IModerationService, auth?: RequestHandler, catalog?: CatalogHttpApplication, reads?: AdminReadService, vouchers?: AdminVoucherService, campaigns?: AdminNotificationCampaignService, orderQueries?: OrderQueryService, orderTransition?: (ctx: RequestContext, orderId: string, input: Record<string, unknown>) => Promise<unknown>): Router {
  const router = Router();

  router.get('/admin/stats', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!reads) throw new NotFoundError('Admin reporting handler is not configured');
    res.json(buildSuccessEnvelope(await reads.getDashboardStats(), requestId(req)));
  }));

  router.get('/admin/reports', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!reads) throw new NotFoundError('Admin reporting handler is not configured');
    const from = typeof req.query.from === 'string' ? req.query.from : '';
    const to = typeof req.query.to === 'string' ? req.query.to : '';
    res.json(buildSuccessEnvelope(await reads.getOperationalReport({ from, to }), requestId(req)));
  }));

  router.get('/admin/orders', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!orderQueries) throw new NotFoundError('Admin order query handler is not configured');
    const page = await orderQueries.listAdminOrdersPaginated(context(req), {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      shop_id: typeof req.query.shop_id === 'string' ? req.query.shop_id : undefined,
      buyer_id: typeof req.query.buyer_id === 'string' ? req.query.buyer_id : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    });
    res.json(buildPaginatedEnvelope(page.items, { next_cursor: page.next_cursor, has_more: page.has_more, limit: page.limit }, requestId(req)));
  }));

  router.get('/admin/orders/:id', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!orderQueries) throw new NotFoundError('Admin order query handler is not configured');
    const order = await orderQueries.getOrderDetail(context(req), req.params.id);
    if (!order) throw new NotFoundError('Order was not found');
    res.json(buildSuccessEnvelope(order, requestId(req)));
  }));

  router.patch('/admin/orders/:id/transition', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!orderTransition) throw new NotFoundError('Admin order command handler is not configured');
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (typeof body.reason !== 'string' || !body.reason.trim()) throw new ReasonRequiredError('A reason is required for Admin order actions.');
    const result = await orderTransition(context(req), req.params.id, { ...body, reason: body.reason.trim() });
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

  router.get('/admin/audit-logs', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!reads) throw new NotFoundError('Admin audit handler is not configured');
    const page = await reads.listAuditLogsPage({
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      target_type: typeof req.query.target_type === 'string' ? req.query.target_type : undefined,
      actor: typeof req.query.actor === 'string' ? req.query.actor : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
      cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
    });
    res.json(buildPaginatedEnvelope(page.items, { next_cursor: page.next_cursor, has_more: page.has_more, limit: page.limit }, requestId(req)));
  }));

  router.get('/admin/vouchers', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!vouchers) throw new NotFoundError('Admin voucher handler is not configured');
    res.json(buildSuccessEnvelope(await vouchers.list(), requestId(req)));
  }));

  router.post('/admin/vouchers', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!vouchers) throw new NotFoundError('Admin voucher handler is not configured');
    const created = await vouchers.create(context(req).user_id, (req.body ?? {}) as Record<string, unknown>);
    res.status(201).json(buildSuccessEnvelope(created, requestId(req)));
  }));

  router.patch('/admin/vouchers/:id', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!vouchers) throw new NotFoundError('Admin voucher handler is not configured');
    const updated = await vouchers.update(context(req).user_id, req.params.id, (req.body ?? {}) as Record<string, unknown>);
    res.json(buildSuccessEnvelope(updated, requestId(req)));
  }));

  router.patch('/admin/vouchers/:id/status', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!vouchers) throw new NotFoundError('Admin voucher handler is not configured');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updated = await vouchers.setStatus(context(req).user_id, req.params.id, body.status, body.reason);
    res.json(buildSuccessEnvelope(updated, requestId(req)));
  }));

  router.post('/admin/notification-campaigns', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!campaigns) throw new NotFoundError('Notification campaign handler is not configured');
    const key = req.header('Idempotency-Key')?.trim() ?? '';
    const body = (req.body ?? {}) as Record<string, unknown>;
    const campaign = await campaigns.create(context(req).user_id, {
      audience_role: body.audience_role, title: body.title, content: body.content,
      reason: body.reason, idempotency_key: key,
    });
    res.status(201).json(buildSuccessEnvelope(campaign, requestId(req)));
  }));

  router.get('/admin/notification-campaigns/preview', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!campaigns) throw new NotFoundError('Notification campaign handler is not configured');
    res.json(buildSuccessEnvelope(await campaigns.preview(req.query.audience_role), requestId(req)));
  }));

  router.get('/admin/notification-campaigns/:id', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    if (!campaigns) throw new NotFoundError('Notification campaign handler is not configured');
    res.json(buildSuccessEnvelope(await campaigns.getProgress(req.params.id), requestId(req)));
  }));

  router.get('/admin/products', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    const service = implementation(moderation?.listModerationProducts, moderation);
    const rows = await service({ status: typeof req.query.status === 'string' ? req.query.status : undefined, search: typeof req.query.search === 'string' ? req.query.search : undefined });
    res.json(buildSuccessEnvelope(rows, requestId(req)));
  }));

  router.get('/admin/reviews', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    const service = implementation(moderation?.listModerationReviews, moderation);
    const rows = await service({ status: typeof req.query.status === 'string' ? req.query.status : undefined, search: typeof req.query.search === 'string' ? req.query.search : undefined });
    res.json(buildSuccessEnvelope(rows, requestId(req)));
  }));

  router.patch('/admin/products/:id/moderate', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.status !== 'HIDDEN' && body.status !== 'ACTIVE') throw new ValidationFailedError('Product moderation status must be HIDDEN or ACTIVE');
    const service = implementation(moderation?.moderateTarget, moderation);
    const result = await service({ admin_id: ctx.user_id, target_type: 'PRODUCT', target_id: req.params.id, action: body.status === 'HIDDEN' ? 'HIDE' : 'RESTORE', reason: typeof body.reason === 'string' ? body.reason : '' });
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

  router.patch('/admin/reviews/:id/moderate', ...guards(auth, 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.status !== 'HIDDEN' && body.status !== 'VISIBLE') throw new ValidationFailedError('Review moderation status must be HIDDEN or VISIBLE');
    const service = implementation(moderation?.moderateTarget, moderation);
    const result = await service({ admin_id: ctx.user_id, target_type: 'REVIEW', target_id: req.params.id, action: body.status === 'HIDDEN' ? 'HIDE' : 'RESTORE', reason: typeof body.reason === 'string' ? body.reason : '' });
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

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

  // GET /admin/categories (C-403)
  router.get(
    '/admin/categories',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const service = implementation(catalog?.listAllCategories, catalog);
      const categories = await service();
      res.json(buildSuccessEnvelope(categories, requestId(req)));
    })
  );

  // POST /admin/categories (C-403: 2-level hierarchy, RB-KN04)
  router.post(
    '/admin/categories',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const input = (req.body ?? {}) as Record<string, unknown>;
      const service = implementation(catalog?.createCategory, catalog);
      const category = await service(input);
      res.status(201).json(buildSuccessEnvelope(category, requestId(req)));
    })
  );

  // PATCH /admin/categories/:id (C-403: cycle check)
  router.patch(
    '/admin/categories/:id',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const targetId = req.params.id;
      const input = (req.body ?? {}) as Record<string, unknown>;
      const service = implementation(catalog?.updateCategory, catalog);
      const category = await service(targetId, input);
      res.json(buildSuccessEnvelope(category, requestId(req)));
    })
  );

  // PATCH /admin/categories/:id/status (C-403)
  router.patch(
    '/admin/categories/:id/status',
    ...guards(auth, 'ADMIN'),
    asyncRoute(async (req, res) => {
      const targetId = req.params.id;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const status = typeof body.status === 'string' ? body.status : '';
      const service = implementation(catalog?.updateCategoryStatus, catalog);
      const result = await service(targetId, status);
      res.json(buildSuccessEnvelope(result, requestId(req)));
    })
  );

  return router;
}
