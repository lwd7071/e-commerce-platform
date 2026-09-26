import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, NotFoundError, ReasonRequiredError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { parseCheckoutCommand } from '../../../modules/checkout/contracts/checkout-command.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { OrderLifecycleService } from '../../../modules/order/services/order-lifecycle.service.ts';
import type { OrderQueryService } from '../../../modules/order/services/order-query.service.ts';
import type { IOrderRepository } from '../../../modules/order/domain/repositories.ts';
import type { OrderActor } from '../../../modules/order/domain/types.ts';
import type { OrderHttpApplication } from './t1-routes.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface OrderServices {
  checkoutService?: {
    createOrder(context: RequestContext, command: ReturnType<typeof parseCheckoutCommand>): Promise<unknown>;
  };
  orderLifecycleService?: OrderLifecycleService;
  orderQueryService?: OrderQueryService;
  orderRepo?: IOrderRepository;
  confirmOrder?(context: RequestContext, orderId: string): Promise<unknown>;
  transitionOrder?(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
  retryPayment?(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
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

function requestId(req: Request): string {
  return req.requestId ?? 'req_unknown';
}

function asyncRoute(handler: AsyncRoute): AsyncRoute {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function createOrderDomainRouter(
  servicesOrApp?: OrderServices | OrderHttpApplication,
  auth?: RequestHandler
): Router {
  const router = Router();

  const isLegacyApp = servicesOrApp && 'confirmOrder' in servicesOrApp && typeof (servicesOrApp as any).confirmOrder === 'function' && !('orderRepo' in servicesOrApp || 'orderLifecycleService' in servicesOrApp);
  const legacyApp = isLegacyApp ? (servicesOrApp as OrderHttpApplication) : undefined;
  const services = (!isLegacyApp ? servicesOrApp : undefined) as OrderServices | undefined;

  const checkoutService = services?.checkoutService ?? (legacyApp ? { createOrder: legacyApp.createOrder.bind(legacyApp) } : undefined);
  const orderLifecycleService = services?.orderLifecycleService;
  const orderQueryService = services?.orderQueryService;
  const orderRepo = services?.orderRepo;

  const confirmHandler = (services?.confirmOrder ?? legacyApp?.confirmOrder)?.bind(services ?? legacyApp);
  const transitionHandler = (services?.transitionOrder ?? legacyApp?.transitionOrder)?.bind(services ?? legacyApp);
  const retryPaymentHandler = (services?.retryPayment ?? legacyApp?.retryPayment)?.bind(services ?? legacyApp);

  // ==========================================
  // 1. CHECKOUT / CREATE ORDER
  // ==========================================
  const handleCheckout = asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!checkoutService) {
      throw new NotFoundError('Checkout handler is not configured');
    }
    const command = parseCheckoutCommand(req.body, req.header('Idempotency-Key'));
    const result = await checkoutService.createOrder(ctx, command);
    res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
  });

  router.post('/checkout', ...guards(auth, 'BUYER'), handleCheckout);
  router.post('/orders', ...guards(auth, 'BUYER'), handleCheckout);

  // ==========================================
  // 2. LIST ORDERS
  // ==========================================
  router.get('/orders', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let orders: unknown[] = [];
    if (orderRepo) {
      if (ctx.role === 'BUYER') {
        orders = await orderRepo.findByBuyerId(ctx.user_id);
      } else if (ctx.role === 'SELLER' && ctx.shop_id) {
        orders = await orderRepo.findByShopId(ctx.shop_id);
      }
    }
    res.json(buildSuccessEnvelope(orders, requestId(req)));
  }));

  // ==========================================
  // 3. GET ORDER BY ID
  // ==========================================
  router.get('/orders/:order_id', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;

    if (orderRepo) {
      const order = await orderRepo.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found');
      }
      if (ctx.role === 'BUYER' && order.buyerId !== ctx.user_id) {
        throw new NotFoundError('Order not found');
      }
      if (ctx.role === 'SELLER' && order.shopId !== ctx.shop_id) {
        throw new ForbiddenError('RESOURCE_FORBIDDEN', 'Access denied to order of another shop');
      }
      const items = await orderRepo.findItemsByOrderId(orderId);
      res.json(buildSuccessEnvelope({ ...order, items }, requestId(req)));
      return;
    }

    if (orderQueryService) {
      const summary = await orderQueryService.getOrderSummary(orderId);
      if (!summary) {
        throw new NotFoundError('Order not found');
      }
      if (ctx.role === 'BUYER' && summary.buyerId !== ctx.user_id) {
        throw new NotFoundError('Order not found');
      }
      res.json(buildSuccessEnvelope(summary, requestId(req)));
      return;
    }

    res.json(buildSuccessEnvelope({ order_id: orderId }, requestId(req)));
  }));

  // ==========================================
  // 4. CANCEL ORDER
  // ==========================================
  router.post('/orders/:order_id/cancel', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const rawReason = req.body?.reason ?? req.body?.cancel_reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : '';

    if (!reason) {
      throw new ReasonRequiredError('A non-blank reason is required to cancel an order.', { field: 'reason' });
    }

    if (orderLifecycleService) {
      let actor: OrderActor;
      if (ctx.role === 'BUYER') {
        actor = { kind: 'BUYER', userId: ctx.user_id };
      } else if (ctx.role === 'SELLER') {
        actor = { kind: 'SELLER', userId: ctx.user_id, shopId: ctx.shop_id ?? '' };
      } else {
        actor = { kind: 'ADMIN', userId: ctx.user_id };
      }

      await orderLifecycleService.cancelOrder(orderId, actor, reason);
      res.json(buildSuccessEnvelope({ order_id: orderId, status: 'CANCELLED' }, requestId(req)));
      return;
    }

    if (legacyApp?.cancelOrder) {
      const result = await legacyApp.cancelOrder(ctx, orderId, req.body as Record<string, unknown>);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    throw new NotFoundError('Order cancel handler is not configured');
  }));

  // ==========================================
  // 5. ORDER CONFIRM, TRANSITION & PAYMENTS
  // ==========================================
  router.post('/orders/:order_id/confirm', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    if (confirmHandler) {
      const result = await confirmHandler(ctx, orderId);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }
    if (orderLifecycleService) {
      const actor: OrderActor = ctx.role === 'ADMIN'
        ? { kind: 'ADMIN', userId: ctx.user_id }
        : { kind: 'SELLER', userId: ctx.user_id, shopId: ctx.shop_id ?? '' };
      await orderLifecycleService.transitionStatus(orderId, 'CONFIRMED' as any, actor, undefined, true);
      const updated = orderRepo ? await orderRepo.findById(orderId) : { order_id: orderId, status: 'CONFIRMED' };
      res.json(buildSuccessEnvelope(updated, requestId(req)));
      return;
    }
    throw new NotFoundError('Order confirm handler is not configured');
  }));

  router.post('/orders/:order_id/transition', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const input = (req.body ?? {}) as Record<string, unknown>;
    if (transitionHandler) {
      const result = await transitionHandler(ctx, orderId, input);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }
    if (orderLifecycleService) {
      const actor: OrderActor = ctx.role === 'ADMIN'
        ? { kind: 'ADMIN', userId: ctx.user_id }
        : { kind: 'SELLER', userId: ctx.user_id, shopId: ctx.shop_id ?? '' };
      await orderLifecycleService.transitionStatus(orderId, input.to as any, actor, input.reason as string | undefined);
      const updated = orderRepo ? await orderRepo.findById(orderId) : { order_id: orderId, status: input.to };
      res.json(buildSuccessEnvelope(updated, requestId(req)));
      return;
    }
    throw new NotFoundError('Order transition handler is not configured');
  }));

  router.post('/orders/:order_id/payments', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const input = (req.body ?? {}) as Record<string, unknown>;
    if (retryPaymentHandler) {
      const result = await retryPaymentHandler(ctx, orderId, input);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }
    throw new NotFoundError('Order payment retry handler is not configured');
  }));

  return router;
}
