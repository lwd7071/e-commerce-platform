import { Router, type Request, type RequestHandler } from 'express';
import type { RequestContext } from '../../context/request-context.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope } from '../envelope.ts';
import type { ShopWalletService } from '../../../modules/wallet/services/shop-wallet.service.ts';

function context(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  if (req.context.role !== 'SELLER' || req.context.shop_status !== 'ACTIVE') {
    throw new ForbiddenError('SHOP_NOT_ACTIVE', 'Chỉ người bán có gian hàng đang hoạt động mới có quyền truy cập ví');
  }
  return req.context;
}

function asyncRoute(handler: (req: Request, res: import('express').Response) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationFailedError('Request body must be an object');
  }
  return value as Record<string, unknown>;
}

export function createSellerWalletRouter(service?: ShopWalletService, auth?: RequestHandler): Router {
  const router = Router();
  const guards = auth ? [auth] : [];
  const requestId = (req: Request) => req.requestId ?? 'req_unknown';
  const configured = () => {
    if (!service) throw new DependencyUnavailableError('Shop wallet service is not configured');
    return service;
  };

  router.get('/seller/wallet', ...guards, asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await configured().getWallet(context(req)), requestId(req)));
  }));

  router.put('/seller/wallet/bank-info', ...guards, asyncRoute(async (req, res) => {
    const input = bodyObject(req.body);
    const bankInfo = {
      bank_name: String(input.bank_name || ''),
      bank_account_number: String(input.bank_account_number || ''),
      bank_account_holder: String(input.bank_account_holder || ''),
    };
    res.json(buildSuccessEnvelope(await configured().updateBankInfo(context(req), bankInfo), requestId(req)));
  }));

  router.post('/seller/wallet/withdraw', ...guards, asyncRoute(async (req, res) => {
    const input = bodyObject(req.body);
    const amount = String(input.amount || '');
    if (!amount) throw new ValidationFailedError('Thiếu số tiền cần rút');
    const result = await configured().requestWithdrawal(context(req), amount);
    res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
  }));

  router.get('/seller/wallet/transactions', ...guards, asyncRoute(async (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    res.json(buildSuccessEnvelope(await configured().listTransactions(context(req), limit), requestId(req)));
  }));

  router.get('/seller/wallet/withdrawals', ...guards, asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await configured().listWithdrawals(context(req)), requestId(req)));
  }));

  return router;
}
