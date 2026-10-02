import { Router, type Request, type RequestHandler } from 'express';
import type { RequestContext } from '../../context/request-context.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope } from '../envelope.ts';
import type { AdminFinanceService } from '../../../modules/wallet/services/admin-finance.service.ts';
import type { WithdrawalStatus } from '../../../modules/wallet/domain/wallet.types.ts';

function adminContext(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  if (req.context.role !== 'ADMIN') {
    throw new ForbiddenError('ADMIN_REQUIRED', 'Chỉ quản trị viên mới có quyền truy cập');
  }
  return req.context;
}

function asyncRoute(handler: (req: Request, res: import('express').Response) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

export function createAdminFinanceRouter(service?: AdminFinanceService, auth?: RequestHandler): Router {
  const router = Router();
  const guards = auth ? [auth] : [];
  const requestId = (req: Request) => req.requestId ?? 'req_unknown';
  const configured = () => {
    if (!service) throw new DependencyUnavailableError('Admin finance service is not configured');
    return service;
  };

  router.get('/admin/finance/overview', ...guards, asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await configured().getOverview(adminContext(req)), requestId(req)));
  }));

  router.get('/admin/finance/withdrawals', ...guards, asyncRoute(async (req, res) => {
    const status = req.query.status as WithdrawalStatus | undefined;
    const shop_id = req.query.shop_id ? String(req.query.shop_id) : undefined;
    res.json(buildSuccessEnvelope(await configured().listWithdrawals(adminContext(req), { status, shop_id }), requestId(req)));
  }));

  router.post('/admin/finance/withdrawals/:id/approve', ...guards, asyncRoute(async (req, res) => {
    const note = req.body?.note ? String(req.body.note) : undefined;
    const result = await configured().approveWithdrawal(adminContext(req), req.params.id, note);
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

  router.post('/admin/finance/withdrawals/:id/reject', ...guards, asyncRoute(async (req, res) => {
    const note = req.body?.note ? String(req.body.note) : undefined;
    const result = await configured().rejectWithdrawal(adminContext(req), req.params.id, note);
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

  return router;
}
