import { Router, type Request, type RequestHandler } from 'express';
import type { RequestContext } from '../../context/request-context.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope } from '../envelope.ts';
import type { SellerShopService } from '../../../modules/shop/services/seller-shop.service.ts';

type AsyncRoute = (req: Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>;

function route(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => { void handler(req, res, next).catch(next); };
}

function requireSeller(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  if (req.context.role !== 'SELLER') throw new ForbiddenError('ROLE_REQUIRED', 'Required role: SELLER');
  return req.context;
}

export function createSellerShopRouter(service?: Pick<SellerShopService, 'get' | 'update'>, auth?: RequestHandler): Router {
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
  return router;
}
