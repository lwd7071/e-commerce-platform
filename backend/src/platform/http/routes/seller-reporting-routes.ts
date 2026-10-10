import { Router, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { SellerRevenueService } from '../../../modules/reporting/services/seller-revenue.service.ts';

export function createSellerReportingRouter(service?: Pick<SellerRevenueService, 'get'>, auth?: RequestHandler): Router {
  const router = Router();
  const handlers = auth ? [auth] : [];
  router.get('/seller/reports/revenue', ...handlers, async (req, res, next) => {
    try {
      if (!req.context) throw new UnauthorizedError();
      if (req.context.role !== 'SELLER') throw new ForbiddenError('ROLE_REQUIRED', 'Required role: SELLER');
      const unknown = Object.keys(req.query).find((key) => !['from', 'to'].includes(key));
      if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
      for (const key of ['from', 'to'] as const) {
        if (req.query[key] !== undefined && typeof req.query[key] !== 'string') throw new ValidationFailedError(`${key} must be a single date value`, { field: key });
      }
      if (!service) throw new DependencyUnavailableError('Seller reporting is not configured');
      const filter = { ...(req.query.from ? { from: String(req.query.from) } : {}), ...(req.query.to ? { to: String(req.query.to) } : {}) };
      res.json(buildSuccessEnvelope(await service.get(req.context as RequestContext, filter), req.requestId ?? 'req_unknown'));
    } catch (error) { next(error); }
  });
  return router;
}
