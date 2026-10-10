import { Router, type Request, type RequestHandler } from 'express';
import type { RequestContext } from '../../context/request-context.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope, buildPaginatedEnvelope } from '../envelope.ts';
import type { SellerShopService } from '../../../modules/shop/services/seller-shop.service.ts';
import type { ShopMallRequestService } from '../../../modules/shop/services/shop-mall-request.service.ts';

type AsyncRoute = (req: Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => { void handler(req, res, next).catch(next); };
}

function requireSeller(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  if (req.context.role !== 'SELLER') throw new ForbiddenError('ROLE_REQUIRED', 'Required role: SELLER');
  return req.context;
}

export function createSellerShopRouter(
  service?: Pick<SellerShopService, 'get' | 'update'>,
  auth?: RequestHandler,
  mallRequestService?: Pick<ShopMallRequestService, 'submitRequest' | 'cancelRequest' | 'listSellerRequests'>
): Router {
  const router = Router();
  const authHandlers = auth ? [auth] : [];

  router.get('/seller/shop', ...authHandlers, route(async (req, res) => {
    if (!service) throw new DependencyUnavailableError('Seller shop service is not configured');
    res.json(buildSuccessEnvelope(await service.get(requireSeller(req)), req.requestId ?? 'req_unknown'));
  }));
  router.patch('/seller/shop', ...authHandlers, route(async (req, res) => {
    if (!service) throw new DependencyUnavailableError('Seller shop service is not configured');
    const input = req.body;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new ValidationFailedError('Request body must be an object');
    }
    res.json(buildSuccessEnvelope(await service.update(requireSeller(req), input as Record<string, unknown>), req.requestId ?? 'req_unknown'));
  }));

  router.post('/seller/shop/mall-requests', ...authHandlers, route(async (req, res) => {
    if (!mallRequestService) throw new DependencyUnavailableError('Shop mall request service is not configured');
    const ctx = requireSeller(req);
    const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined;
    const result = await mallRequestService.submitRequest(ctx, req.body, idempotencyKey);
    res.status(201).json(buildSuccessEnvelope(result, req.requestId ?? 'req_unknown'));
  }));

  router.get('/seller/shop/mall-requests', ...authHandlers, route(async (req, res) => {
    if (!mallRequestService) throw new DependencyUnavailableError('Shop mall request service is not configured');
    const ctx = requireSeller(req);
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await mallRequestService.listSellerRequests(ctx, { limit, cursor });
    res.json(buildPaginatedEnvelope(result.items, { next_cursor: result.next_cursor, has_more: result.has_more, limit }, req.requestId ?? 'req_unknown'));
  }));

  router.post('/seller/shop/mall-requests/:id/cancel', ...authHandlers, route(async (req, res) => {
    if (!mallRequestService) throw new DependencyUnavailableError('Shop mall request service is not configured');
    const ctx = requireSeller(req);
    const result = await mallRequestService.cancelRequest(ctx, req.params.id);
    res.json(buildSuccessEnvelope(result, req.requestId ?? 'req_unknown'));
  }));

  return router;
}
