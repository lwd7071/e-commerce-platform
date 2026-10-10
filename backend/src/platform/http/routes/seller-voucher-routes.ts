import { Router, type Request, type RequestHandler } from 'express';
import type { RequestContext } from '../../context/request-context.ts';
import { DependencyUnavailableError, ForbiddenError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { buildSuccessEnvelope } from '../envelope.ts';
import type { SellerVoucherService } from '../../../modules/voucher/services/seller-voucher.service.ts';

function context(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  if (req.context.role !== 'SELLER' || req.context.shop_status !== 'ACTIVE') throw new ForbiddenError('SHOP_NOT_ACTIVE', 'An active Seller shop is required');
  return req.context;
}

function asyncRoute(handler: (req: Request, res: import('express').Response) => Promise<void>): RequestHandler {
  return (req, res, next) => { void handler(req, res).catch(next); };
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationFailedError('Request body must be an object');
  return value as Record<string, unknown>;
}

function rejectUnknown(input: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(input).find(key => !allowed.includes(key));
  if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
}

const fields = ['code', 'voucher_name', 'discount_type', 'discount_value', 'max_discount', 'min_order_value', 'quantity', 'start_at', 'end_at'] as const;

export function createSellerVoucherRouter(service?: Pick<SellerVoucherService, 'list' | 'get' | 'create' | 'update' | 'setStatus'>, auth?: RequestHandler): Router {
  const router = Router();
  const guards = auth ? [auth] : [];
  const requestId = (req: Request) => req.requestId ?? 'req_unknown';
  const configured = () => { if (!service) throw new DependencyUnavailableError('Seller voucher service is not configured'); return service; };

  router.get('/seller/vouchers', ...guards, asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await configured().list(context(req)), requestId(req)));
  }));
  router.post('/seller/vouchers', ...guards, asyncRoute(async (req, res) => {
    const input = bodyObject(req.body); rejectUnknown(input, fields);
    res.status(201).json(buildSuccessEnvelope(await configured().create(context(req), input), requestId(req)));
  }));
  router.get('/seller/vouchers/:voucher_id', ...guards, asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await configured().get(context(req), req.params.voucher_id), requestId(req)));
  }));
  router.patch('/seller/vouchers/:voucher_id', ...guards, asyncRoute(async (req, res) => {
    const input = bodyObject(req.body); rejectUnknown(input, fields);
    res.json(buildSuccessEnvelope(await configured().update(context(req), req.params.voucher_id, input), requestId(req)));
  }));
  router.patch('/seller/vouchers/:voucher_id/status', ...guards, asyncRoute(async (req, res) => {
    const input = bodyObject(req.body); rejectUnknown(input, ['status']);
    res.json(buildSuccessEnvelope(await configured().setStatus(context(req), req.params.voucher_id, input.status), requestId(req)));
  }));
  return router;
}
