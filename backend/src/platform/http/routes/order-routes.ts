import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildPaginatedEnvelope, buildSuccessEnvelope } from '../envelope.ts';
import { DependencyUnavailableError, ForbiddenError, NotFoundError, ReasonRequiredError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import { parseCheckoutCommand } from '../../../modules/checkout/contracts/checkout-command.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { OrderLifecycleService } from '../../../modules/order/services/order-lifecycle.service.ts';
import type { OrderQueryService } from '../../../modules/order/services/order-query.service.ts';
import type { OrderActor, OrderStatus } from '../../../modules/order/domain/types.ts';
import type { PaymentService } from '../../../modules/payment/services/payment.service.ts';
import type { OrderHttpApplication } from './t1-routes.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface OrderServices {
  checkoutService?: {
    createOrder(context: RequestContext, command: ReturnType<typeof parseCheckoutCommand>): Promise<unknown>;
    quoteShipping?(context: RequestContext, input: Record<string, unknown>): Promise<unknown>;
    cancelOrder?(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
    confirmOrder?(context: RequestContext, orderId: string, reason?: string): Promise<unknown>;
  };
  cancelOrder?(context: RequestContext, orderId: string, input: Record<string, unknown>): Promise<unknown>;
  orderLifecycleService?: OrderLifecycleService;
  orderQueryService?: OrderQueryService;
  paymentService?: PaymentService;
  confirmOrder?(context: RequestContext, orderId: string, reason?: string): Promise<unknown>;
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
      if (requestContext.role === 'SELLER' && roles.includes('SELLER') && requestContext.shop_status !== 'ACTIVE') {
        throw new ForbiddenError('SHOP_NOT_ACTIVE', 'Seller shop must be active before using seller operations');
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

  const isLegacyApp = servicesOrApp && 'confirmOrder' in servicesOrApp && typeof (servicesOrApp as { confirmOrder?: unknown }).confirmOrder === 'function' && !('orderLifecycleService' in servicesOrApp || 'orderQueryService' in servicesOrApp);
  const legacyApp = isLegacyApp ? (servicesOrApp as OrderHttpApplication) : undefined;
  const services = (!isLegacyApp ? servicesOrApp : undefined) as OrderServices | undefined;

  const checkoutService = services?.checkoutService ?? (legacyApp ? { createOrder: legacyApp.createOrder.bind(legacyApp) } : undefined);
  const orderLifecycleService = services?.orderLifecycleService;
  const orderQueryService = services?.orderQueryService;
  const paymentService = services?.paymentService;

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
  router.post('/shipping/quote', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const handler = checkoutService?.quoteShipping ?? legacyApp?.quoteShipping;
    if (!handler) throw new NotFoundError('Shipping quote handler is not configured');
    const result = await handler.call(checkoutService ?? legacyApp, context(req), req.body as Record<string, unknown>);
    res.json(buildSuccessEnvelope(result, requestId(req)));
  }));

  // ==========================================
  // 2. LIST ORDERS
  // ==========================================
  router.get('/orders', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const unknown = Object.keys(req.query).find(key => !['status', 'limit', 'cursor'].includes(key));
    if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
    const status = req.query.status;
    if (status !== undefined && typeof status !== 'string') throw new ValidationFailedError('Status must be a single value', { field: 'status' });
    const limit = req.query.limit === undefined ? undefined : Number(req.query.limit);
    const cursor = req.query.cursor;
    if (cursor !== undefined && typeof cursor !== 'string') throw new ValidationFailedError('Cursor must be a single value', { field: 'cursor' });

    if (!orderQueryService) throw new DependencyUnavailableError('Order reads are not configured');
    const page = await orderQueryService.listOrdersPaginated(ctx, { ...(status ? { status } : {}), ...(limit === undefined ? {} : { limit }), ...(cursor ? { cursor } : {}) });
    res.json(buildPaginatedEnvelope(page.items, { next_cursor: page.next_cursor, has_more: page.has_more, limit: page.limit }, requestId(req)));
  }));

  // ==========================================
  // 3. GET ORDER BY ID
  // ==========================================
  router.get('/orders/:order_id', ...guards(auth, 'BUYER', 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;

    if (!orderQueryService) throw new DependencyUnavailableError('Order reads are not configured');
    const order = await orderQueryService.getOrderDetail(ctx, orderId);
    if (!order) throw new NotFoundError('Order not found');
    res.json(buildSuccessEnvelope(order, requestId(req)));
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

    if (services?.cancelOrder) {
      const result = await services.cancelOrder(ctx, orderId, req.body as Record<string, unknown>);
      res.json(buildSuccessEnvelope(result, requestId(req)));
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
  // 5. ORDER OPERATIONS (CONFIRM, TRANSITION, PAYMENT RETRY)
  // ==========================================
  router.post('/orders/:order_id/confirm', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : undefined;
    if (ctx.role === 'ADMIN' && !reason) throw new ReasonRequiredError('A reason is required for admin order actions.');

    if (orderLifecycleService) {
      let actor: OrderActor;
      if (ctx.role === 'SELLER') {
        actor = { kind: 'SELLER', userId: ctx.user_id, shopId: ctx.shop_id ?? '' };
      } else {
        actor = { kind: 'ADMIN', userId: ctx.user_id };
      }

      const result = await orderLifecycleService.confirmOrder(orderId, actor, reason);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    if (confirmHandler) {
      const result = await confirmHandler(ctx, orderId, reason);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    if (legacyApp?.confirmOrder) {
      const result = await legacyApp.confirmOrder(ctx, orderId, reason);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    throw new NotFoundError('Order confirm handler is not configured');
  }));

  router.post('/orders/:order_id/confirm-received', ...guards(auth, 'BUYER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : undefined;
    if (ctx.role === 'ADMIN' && !reason) throw new ReasonRequiredError('A reason is required for admin order actions.');

    if (orderLifecycleService) {
      const actor: OrderActor = ctx.role === 'ADMIN'
        ? { kind: 'ADMIN', userId: ctx.user_id }
        : { kind: 'BUYER', userId: ctx.user_id };

      const result = await orderLifecycleService.confirmReceived(orderId, actor, reason);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    if (legacyApp?.confirmReceived) {
      const result = await legacyApp.confirmReceived(ctx, orderId, reason);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    throw new NotFoundError('Order confirm-received handler is not configured');
  }));

  router.post('/orders/:order_id/transition', ...guards(auth, 'SELLER', 'ADMIN'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;
    const rawReason = req.body?.reason;
    const reason = typeof rawReason === 'string' ? rawReason.trim() : undefined;
    if (ctx.role === 'ADMIN' && !reason) throw new ReasonRequiredError('A reason is required for admin order actions.');
    if (ctx.role === 'SELLER' && req.body?.to === 'SHIPPING' && req.body?.shipment_status !== undefined && req.body.shipment_status !== 'HANDED_OVER') {
      throw new ValidationFailedError('Seller handover must use shipment_status HANDED_OVER.');
    }

    if (orderLifecycleService) {
      let actor: OrderActor;
      if (ctx.role === 'SELLER') {
        actor = { kind: 'SELLER', userId: ctx.user_id, shopId: ctx.shop_id ?? '' };
      } else {
        actor = { kind: 'ADMIN', userId: ctx.user_id };
      }

      const to = req.body?.to as OrderStatus;
      const exceptionalCancellation = req.body?.exceptional_cancellation === true;
      const shipmentStatus = req.body?.shipment_status ?? (to === 'SHIPPING' && ctx.role === 'SELLER' ? 'HANDED_OVER' : undefined);
      const processingEligible = req.body?.processing_eligible !== false;

      const result = await orderLifecycleService.transitionOrder(orderId, actor, {
        to,
        reason,
        exceptionalCancellation,
        shipmentStatus,
        processingEligible,
      });
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    const input = {
      ...((req.body ?? {}) as Record<string, unknown>),
      ...(ctx.role === 'SELLER' && req.body?.to === 'SHIPPING' ? { shipment_status: 'HANDED_OVER' } : {}),
      reason,
    };
    if (transitionHandler) {
      const result = await transitionHandler(ctx, orderId, input);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    if (legacyApp?.transitionOrder) {
      const result = await legacyApp.transitionOrder(ctx, orderId, req.body as Record<string, unknown>);
      res.json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    throw new NotFoundError('Order transition handler is not configured');
  }));

  router.post('/orders/:order_id/payments', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    const orderId = req.params.order_id;

    if (paymentService) {
      const rawMethod = req.body?.payment_method ?? req.body?.method ?? 'ONLINE';
      const method = rawMethod === 'COD' ? 'COD' : 'ONLINE';
      const result = await paymentService.retryPayment(orderId, ctx.user_id, method);
      res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    const input = (req.body ?? {}) as Record<string, unknown>;
    if (retryPaymentHandler) {
      const result = await retryPaymentHandler(ctx, orderId, input);
      res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }

    if (legacyApp?.retryPayment) {
      const result = await legacyApp.retryPayment(ctx, orderId, req.body as Record<string, unknown>);
      res.status(201).json(buildSuccessEnvelope(result, requestId(req)));
      return;
    }
    throw new NotFoundError('Order payment retry handler is not configured');
  }));

  return router;
}
