import { Router, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { SellerKpiService } from '../../../modules/reporting/services/seller-kpi.service.ts';

export function createSellerAnalyticsRouter(service?: Pick<SellerKpiService, 'get'>, auth?: RequestHandler): Router {
  const router = Router();
  const handlers = auth ? [auth] : [];
  router.get('/seller/kpi', ...handlers, async (req, res, next) => {
    try {
      if (!req.context) throw new UnauthorizedError();
      if (req.context.role !== 'SELLER') throw new ForbiddenError('ROLE_REQUIRED', 'Required role: SELLER');
      if (Object.keys(req.query).length > 0) throw new ValidationFailedError('Seller KPI does not accept query parameters');
      if (!service) throw new NotFoundError('Seller KPI service is not configured');
      const result = await service.get(req.context as RequestContext);
      res.json(buildSuccessEnvelope(result, req.requestId ?? 'req_unknown'));
    } catch (error) { next(error); }
  });
  return router;
}
