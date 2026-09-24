import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { AddressService } from '../../../modules/buyer/services/address.service.ts';
import type { CartService } from '../../../modules/buyer/services/cart.service.ts';
import type { VoucherService } from '../../../modules/buyer/services/voucher.service.ts';
import type { ReviewService } from '../../../modules/buyer/services/review.service.ts';
import type { NotificationService } from '../../../modules/buyer/services/notification.service.ts';
import type { BuyerHttpApplication } from './t1-routes.ts';
import type { VoucherScope } from '../../../modules/buyer/domain/types.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface BuyerServices {
  addressService?: AddressService;
  cartService?: CartService;
  voucherService?: VoucherService;
  reviewService?: ReviewService;
  notificationService?: NotificationService;
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

export function createBuyerDomainRouter(
  servicesOrApp?: BuyerServices | BuyerHttpApplication,
  auth?: RequestHandler
): Router {
  const router = Router();

  // If a legacy BuyerHttpApplication is passed, delegate standard routes to it
  const isLegacyApp = servicesOrApp && 'listAddresses' in servicesOrApp && typeof servicesOrApp.listAddresses === 'function';
  const legacyApp = isLegacyApp ? (servicesOrApp as BuyerHttpApplication) : undefined;
  const services = (!isLegacyApp ? servicesOrApp : undefined) as BuyerServices | undefined;

  const addressService = services?.addressService;
  const cartService = services?.cartService;
  const voucherService = services?.voucherService;
  const reviewService = services?.reviewService;
  const notificationService = services?.notificationService;

  // ==========================================
  // 1. ADDRESS ROUTES
  // ==========================================
  router.get('/addresses', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let data: unknown;
    if (addressService) {
      data = await addressService.getAddresses(ctx.user_id);
    } else if (legacyApp) {
      data = await legacyApp.listAddresses(ctx);
    } else {
      data = [];
    }
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.post('/addresses', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let data: unknown;
    if (addressService) {
      data = await addressService.createAddress(ctx.user_id, req.body);
    } else if (legacyApp) {
      data = await legacyApp.createAddress(ctx, req.body);
    } else {
      data = req.body;
    }
    res.status(201).json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.get('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      res.status(501).json({ error: 'AddressService not configured' });
      return;
    }
    const data = await addressService.getAddressById(ctx.user_id, req.params.address_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.patch('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      res.status(501).json({ error: 'AddressService not configured' });
      return;
    }
    const data = await addressService.updateAddress(ctx.user_id, req.params.address_id, req.body);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.delete('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      res.status(204).send();
      return;
    }
    await addressService.deleteAddress(ctx.user_id, req.params.address_id);
    res.status(204).send();
  }));

  router.patch('/addresses/:address_id/default', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      res.status(501).json({ error: 'AddressService not configured' });
      return;
    }
    await addressService.setDefault(ctx.user_id, req.params.address_id);
    res.json(buildSuccessEnvelope({ message: 'Default address updated successfully' }, requestId(req)));
  }));

  // ==========================================
  // 2. CART ROUTES
  // ==========================================
  router.get('/cart', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let data: unknown;
    if (cartService) {
      data = await cartService.getCart(ctx.user_id);
    } else if (legacyApp) {
      data = await legacyApp.getCart(ctx);
    } else {
      data = { cart_id: null, buyer_id: ctx.user_id, items: [] };
    }
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.post('/cart/items', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let data: unknown;
    if (cartService) {
      data = await cartService.addItem(ctx.user_id, req.body);
    } else if (legacyApp) {
      data = await legacyApp.addCartItem(ctx, req.body);
    } else {
      data = req.body;
    }
    res.status(201).json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.patch('/cart/items/:cart_item_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    let data: unknown;
    if (cartService) {
      data = await cartService.updateItem(ctx.user_id, req.params.cart_item_id, req.body);
    } else if (legacyApp) {
      data = await legacyApp.updateCartItem(ctx, req.params.cart_item_id, req.body);
    } else {
      data = req.body;
    }
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.delete('/cart/items/:cart_item_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (cartService) {
      await cartService.removeItem(ctx.user_id, req.params.cart_item_id);
    } else if (legacyApp) {
      await legacyApp.deleteCartItem(ctx, req.params.cart_item_id);
    }
    res.status(204).send();
  }));

  router.delete('/cart/selected', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (cartService) {
      const { items } = await cartService.getCart(ctx.user_id);
      const selectedItemIds = items.filter(i => i.isSelected).map(i => i.cartItemId);
      if (selectedItemIds.length > 0) {
        await cartService.clearCheckedOutItems(ctx.user_id, selectedItemIds);
      }
    }
    res.status(204).send();
  }));

  // ==========================================
  // 3. VOUCHER ROUTES
  // ==========================================
  const handleListVouchers = asyncRoute(async (req, res) => {
    const ctx = context(req);
    const scope = (req.query.scope as VoucherScope) || undefined;
    const shopId = (req.query.shop_id as string) || (req.query.shopId as string) || undefined;
    const nowStr = (req.query.now as string) || undefined;

    let data: unknown;
    if (voucherService) {
      data = await voucherService.listActiveVouchers(scope, shopId, nowStr);
    } else if (legacyApp) {
      data = await legacyApp.applicableVouchers(ctx, req.query as Record<string, unknown>);
    } else {
      data = [];
    }
    res.json(buildSuccessEnvelope(data, requestId(req)));
  });

  router.get('/vouchers', ...guards(auth, 'BUYER'), handleListVouchers);
  router.get('/vouchers/applicable', ...guards(auth, 'BUYER'), handleListVouchers);

  const handleEvaluateVoucher = asyncRoute(async (req, res) => {
    const ctx = context(req);
    const body = req.body as Record<string, unknown>;
    let data: unknown;
    if (voucherService) {
      const code = String(body.code || '');
      const subtotal = String(body.order_subtotal ?? body.orderSubtotal ?? '0.00');
      const shopId = (body.shop_id as string) ?? (body.shopId as string) ?? undefined;
      const nowStr = (body.now as string) ?? undefined;

      data = await voucherService.previewVoucher({
        buyerId: ctx.user_id,
        code,
        orderSubtotal: subtotal,
        shopId,
        now: nowStr,
      });
    } else if (legacyApp) {
      data = await legacyApp.evaluateVoucher(ctx, body);
    } else {
      data = body;
    }
    res.json(buildSuccessEnvelope(data, requestId(req)));
  });

  router.post('/vouchers/evaluate', ...guards(auth, 'BUYER'), handleEvaluateVoucher);
  router.post('/vouchers/preview', ...guards(auth, 'BUYER'), handleEvaluateVoucher);

  // ==========================================
  // 4. REVIEW ROUTES
  // ==========================================
  const handleCreateReview = asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!reviewService) {
      res.status(501).json({ error: 'ReviewService not configured' });
      return;
    }
    const orderItemId = req.params.order_item_id || req.body?.order_item_id || req.body?.orderItemId;
    const productId = req.body?.product_id || req.body?.productId;

    const content = req.body?.content ?? req.body?.comment ?? undefined;
    const reviewPayload: Record<string, unknown> = {
      rating: req.body?.rating,
    };
    if (content !== undefined) reviewPayload.content = content;
    if (req.body?.images !== undefined) reviewPayload.images = req.body.images;

    const data = await reviewService.createReview(ctx.user_id, orderItemId, productId, reviewPayload);
    res.status(201).json(buildSuccessEnvelope(data, requestId(req)));
  });

  router.post('/order-items/:order_item_id/review', ...guards(auth, 'BUYER'), handleCreateReview);
  router.post('/reviews', ...guards(auth, 'BUYER'), handleCreateReview);

  // ==========================================
  // 5. NOTIFICATION ROUTES
  // ==========================================
  router.get('/notifications', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!notificationService) {
      res.status(501).json({ error: 'NotificationService not configured' });
      return;
    }
    let isRead: boolean | undefined = undefined;
    if (req.query.is_read !== undefined) {
      isRead = req.query.is_read === 'true';
    }
    const data = await notificationService.getNotifications(ctx.user_id, isRead);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.get('/notifications/:notification_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!notificationService) {
      res.status(501).json({ error: 'NotificationService not configured' });
      return;
    }
    const data = await notificationService.getNotificationById(ctx.user_id, req.params.notification_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  const handleMarkNotificationRead = asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!notificationService) {
      res.status(501).json({ error: 'NotificationService not configured' });
      return;
    }
    const data = await notificationService.markAsRead(ctx.user_id, req.params.notification_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  });

  router.patch('/notifications/:notification_id/read', ...guards(auth, 'BUYER'), handleMarkNotificationRead);
  router.patch('/notifications/:notification_id', ...guards(auth, 'BUYER'), handleMarkNotificationRead);

  return router;
}
