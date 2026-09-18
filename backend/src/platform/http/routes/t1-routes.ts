import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildPaginatedEnvelope, buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { parseCheckoutCommand } from '../../../modules/checkout/contracts/checkout-command.ts';
import type { RequestContext } from '../../context/request-context.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface CatalogHttpApplication {
  listProducts(input: Record<string, unknown>): Promise<{ items: unknown[]; next_cursor: string | null; has_more: boolean; limit: number }>;
  getProduct(productId: string): Promise<unknown>;
  createProduct(context: RequestContext, input: Record<string, unknown>): Promise<unknown>;
  updateVariantStock(context: RequestContext, variantId: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface BuyerHttpApplication {
  listAddresses(context: RequestContext): Promise<unknown[]>;
  createAddress(context: RequestContext, input: Record<string, unknown>): Promise<unknown>;
  getCart(context: RequestContext): Promise<unknown>;
  addCartItem(context: RequestContext, input: Record<string, unknown>): Promise<unknown>;
  updateCartItem(context: RequestContext, itemId: string, input: Record<string, unknown>): Promise<unknown>;
  deleteCartItem(context: RequestContext, itemId: string): Promise<void>;
  applicableVouchers(context: RequestContext, input: Record<string, unknown>): Promise<unknown[]>;
  evaluateVoucher(context: RequestContext, input: Record<string, unknown>): Promise<unknown>;
}

export interface OrderHttpApplication {
  createOrder(context: RequestContext, command: ReturnType<typeof parseCheckoutCommand>): Promise<unknown>;
  cancelOrder(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
  confirmOrder(context: RequestContext, orderId: string): Promise<unknown>;
  transitionOrder(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
  retryPayment(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface T1RouteApplications {
  auth?: RequestHandler;
  catalog?: CatalogHttpApplication;
  buyer?: BuyerHttpApplication;
  orders?: OrderHttpApplication;
}

function guards(auth: RequestHandler | undefined, ...roles: Role[]): RequestHandler[] {
  return auth ? [auth, requireRole(...roles)] : [requireRole(...roles)];
}

function context(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  return req.context;
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

function implementation<T extends (...args: any[]) => Promise<any>>(method: T | undefined): T {
  if (method) return method;
  return (async () => {
    throw new NotFoundError('T1 application handler is not configured');
  }) as unknown as T;
}

function rejectUnknown(input: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(input).find((key) => !allowed.includes(key));
  if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
}

function requestId(req: Request): string {
  return req.requestId ?? 'req_unknown';
}

export function createCatalogRouter(application?: CatalogHttpApplication, auth?: RequestHandler): Router {
  const router = Router();
  router.get('/products', asyncRoute(async (req, res) => {
    const allowed = ['category_id', 'search', 'min_price', 'max_price', 'sort', 'limit', 'cursor'];
    const input = req.query as Record<string, unknown>;
    rejectUnknown(input, allowed);
    const result = await implementation(application?.listProducts)(input);
    res.json(buildPaginatedEnvelope(result.items, {
      next_cursor: result.next_cursor,
      has_more: result.has_more,
      limit: result.limit,
    }, requestId(req)));
  }));
  router.get('/products/:product_id', asyncRoute(async (req, res) => {
    const result = await implementation(application?.getProduct)(req.params.product_id);
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));
  router.post('/products', ...guards(auth, 'SELLER'), asyncRoute(async (req, res) => {
    const input = req.body as Record<string, unknown>;
    rejectUnknown(input, ['category_id', 'product_name', 'description', 'variants', 'images']);
    const result = await implementation(application?.createProduct)(context(req), input);
    res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
  }));
  router.patch('/product-variants/:variant_id/stock', ...guards(auth, 'SELLER'), asyncRoute(async (req, res) => {
    const input = req.body as Record<string, unknown>;
    rejectUnknown(input, ['quantity']);
    const result = await implementation(application?.updateVariantStock)(context(req), req.params.variant_id, input);
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));
  return router;
}

export function createBuyerRouter(application?: BuyerHttpApplication, auth?: RequestHandler): Router {
  const router = Router();
  router.get('/addresses', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.listAddresses)(context(req)), requestId(req)));
  }));
  router.post('/addresses', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const input = req.body as Record<string, unknown>;
    rejectUnknown(input, ['recipient_name', 'phone', 'province', 'district', 'ward', 'detail_address', 'is_default']);
    res.status(201).json(buildSuccessEnvelope(await implementation(application?.createAddress)(context(req), input), requestId(req)));
  }));
  router.get('/cart', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.getCart)(context(req)), requestId(req)));
  }));
  router.post('/cart/items', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const input = req.body as Record<string, unknown>;
    rejectUnknown(input, ['variant_id', 'quantity']);
    res.status(201).json(buildSuccessEnvelope(await implementation(application?.addCartItem)(context(req), input), requestId(req)));
  }));
  router.patch('/cart/items/:cart_item_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const input = req.body as Record<string, unknown>;
    rejectUnknown(input, ['quantity', 'is_selected']);
    res.json(buildSuccessEnvelope(await implementation(application?.updateCartItem)(context(req), req.params.cart_item_id, input), requestId(req)));
  }));
  router.delete('/cart/items/:cart_item_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    await implementation(application?.deleteCartItem)(context(req), req.params.cart_item_id);
    res.status(204).send();
  }));
  router.get('/vouchers/applicable', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.applicableVouchers)(context(req), req.query as Record<string, unknown>), requestId(req)));
  }));
  router.post('/vouchers/evaluate', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.evaluateVoucher)(context(req), req.body as Record<string, unknown>), requestId(req)));
  }));
  return router;
}

export function createOrderRouter(application?: OrderHttpApplication, auth?: RequestHandler): Router {
  const router = Router();
  router.post('/orders', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const command = parseCheckoutCommand(req.body, req.header('Idempotency-Key'));
    res.status(201).json(buildSuccessEnvelope(await implementation(application?.createOrder)(context(req), command), requestId(req)));
  }));
  router.post('/orders/:order_id/cancel', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.cancelOrder)(context(req), req.params.order_id, req.body as Record<string, unknown>), requestId(req)));
  }));
  router.post('/orders/:order_id/confirm', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.confirmOrder)(context(req), req.params.order_id), requestId(req)));
  }));
  router.post('/orders/:order_id/transition', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.transitionOrder)(context(req), req.params.order_id, req.body as Record<string, unknown>), requestId(req)));
  }));
  router.post('/orders/:order_id/payments', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    res.json(buildSuccessEnvelope(await implementation(application?.retryPayment)(context(req), req.params.order_id, req.body as Record<string, unknown>), requestId(req)));
  }));
  return router;
}

function asyncRoute(handler: AsyncRoute): AsyncRoute {
  return async (req, res, next) => {
    try { await handler(req, res, next); } catch (error) { next(error); }
  };
}
