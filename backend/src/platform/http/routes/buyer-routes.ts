import { Router, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import { buildSuccessEnvelope } from '../envelope.ts';
import { DependencyUnavailableError, ForbiddenError, NotImplementedError, UnauthorizedError, ValidationFailedError } from '../../errors/app-error.ts';
import type { RequestContext } from '../../context/request-context.ts';
import type { AddressService } from '../../../modules/buyer/services/address.service.ts';
import type { CartService } from '../../../modules/buyer/services/cart.service.ts';
import type { VoucherService } from '../../../modules/buyer/services/voucher.service.ts';
import type { ReviewService } from '../../../modules/buyer/services/review.service.ts';
import type { NotificationService } from '../../../modules/buyer/services/notification.service.ts';
import type { ProfileService } from '../../../modules/buyer/services/profile.service.ts';
import type { BuyerHttpApplication } from './t1-routes.ts';
import type { VoucherScope } from '../../../modules/buyer/domain/types.ts';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;
type Role = 'BUYER' | 'SELLER' | 'ADMIN';

export interface BuyerServices {
  legacyHttpApplication?: BuyerHttpApplication;
  addressService?: AddressService;
  cartService?: CartService;
  voucherService?: VoucherService;
  reviewService?: ReviewService;
  notificationService?: NotificationService;
  profileService?: ProfileService;
}

function guards(auth: RequestHandler | undefined, ...roles: Role[]): RequestHandler[] {
  return auth ? [auth, requireRole(...roles)] : [requireRole(...roles)];
}

function context(req: Request): RequestContext {
  if (!req.context) throw new UnauthorizedError();
  return req.context;
}

function profileGuards(auth: RequestHandler | undefined): RequestHandler[] {
  const handler: RequestHandler = (req, _res, next) => {
    try {
      const requestContext = context(req);
      if (!['BUYER', 'SELLER', 'ADMIN'].includes(requestContext.role as Role)) {
        throw new ForbiddenError('ROLE_REQUIRED', 'Required role: BUYER or SELLER or ADMIN');
      }
      // role-business-rules.md §7: Personal profile operations must not be blocked by Shop PENDING status
      next();
    } catch (error) {
      next(error);
    }
  };
  return auth ? [auth, handler] : [handler];
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

export function createBuyerDomainRouter(
  servicesOrApp?: BuyerServices | BuyerHttpApplication,
  auth?: RequestHandler
): Router {
  const router = Router();

  // If a legacy BuyerHttpApplication is passed, delegate standard routes to it
  const isLegacyApp = servicesOrApp && 'listAddresses' in servicesOrApp && typeof servicesOrApp.listAddresses === 'function';
  const services = servicesOrApp as BuyerServices | undefined;
  const legacyApp = isLegacyApp
    ? servicesOrApp as BuyerHttpApplication
    : services?.legacyHttpApplication;

  const addressService = services?.addressService;
  const cartService = services?.cartService;
  const voucherService = services?.voucherService;
  const reviewService = services?.reviewService;
  const notificationService = services?.notificationService;
  const profileService = services?.profileService;

  router.get('/profile', ...profileGuards(auth), asyncRoute(async (req, res) => {
    if (!profileService) throw new NotImplementedError('Profile is not available in the current runtime');
    const profile = await profileService.getProfile(context(req).user_id);
    res.json(buildSuccessEnvelope({
      user_id: profile.userId,
      full_name: profile.fullName,
      phone: profile.phone,
      avatar_url: profile.avatarUrl,
      updated_at: profile.updatedAt,
    }, requestId(req)));
  }));

  router.patch('/profile', ...profileGuards(auth), asyncRoute(async (req, res) => {
    if (!profileService) throw new NotImplementedError('Profile is not available in the current runtime');
    const input = req.body as Record<string, unknown>;
    const unknown = Object.keys(input ?? {}).find(key => !['full_name', 'phone'].includes(key));
    if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
    if (input.full_name !== undefined && (typeof input.full_name !== 'string' || input.full_name.trim().length < 2 || input.full_name.trim().length > 150)) {
      throw new ValidationFailedError('Full name must contain 2 to 150 characters', { field: 'full_name' });
    }
    if (input.phone !== undefined && input.phone !== null && (typeof input.phone !== 'string' || !/^(?:0\d{9,10}|\+84\d{9,10})$/.test(input.phone.trim()))) {
      throw new ValidationFailedError('Phone number is invalid', { field: 'phone' });
    }
    const profile = await profileService.updateProfile(context(req).user_id, input);
    res.json(buildSuccessEnvelope({
      user_id: profile.userId,
      full_name: profile.fullName,
      phone: profile.phone,
      avatar_url: profile.avatarUrl,
      updated_at: profile.updatedAt,
    }, requestId(req)));
  }));

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
      throw new DependencyUnavailableError('Address service is not configured');
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
      throw new DependencyUnavailableError('Address service is not configured');
    }
    res.status(201).json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.get('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      throw new NotImplementedError('Address detail is not available in the current runtime');
    }
    const data = await addressService.getAddressById(ctx.user_id, req.params.address_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.patch('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      throw new NotImplementedError('Address update is not available in the current runtime');
    }
    const data = await addressService.updateAddress(ctx.user_id, req.params.address_id, req.body);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  router.delete('/addresses/:address_id', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      throw new NotImplementedError('Address deletion is not available in the current runtime');
    }
    await addressService.deleteAddress(ctx.user_id, req.params.address_id);
    res.status(204).send();
  }));

  router.patch('/addresses/:address_id/default', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!addressService) {
      throw new NotImplementedError('Setting a default address is not available in the current runtime');
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
      throw new DependencyUnavailableError('Cart service is not configured');
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
    } else if (legacyApp?.clearSelectedCartItems) {
      await legacyApp.clearSelectedCartItems(ctx);
    } else {
      throw new NotImplementedError('Selected cart item deletion is not available in the current runtime');
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
      throw new NotImplementedError('Review submission is not available in the current runtime');
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

  router.get('/products/:product_id/reviews', asyncRoute(async (req, res) => {
    if (!reviewService) {
      throw new NotImplementedError('Product reviews are not available in the current runtime');
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const { reviews, nextCursor } = await reviewService.getReviewsByProduct(req.params.product_id, limit, cursor);

    const count = reviews.length;
    let average: string | null = null;
    if (count > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      average = (sum / count).toFixed(1);
    }

    res.json({
      data: reviews,
      meta: {
        limit,
        has_more: !!nextCursor,
        next_cursor: nextCursor ?? null,
      },
      rating_summary: {
        average,
        count,
      },
      request_id: requestId(req),
    });
  }));

  // ==========================================
  // 5. NOTIFICATION ROUTES
  // ==========================================
  router.get('/notifications', ...guards(auth, 'BUYER'), asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!notificationService) {
      throw new NotImplementedError('Notifications are not available in the current runtime');
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
      throw new NotImplementedError('Notification details are not available in the current runtime');
    }
    const data = await notificationService.getNotificationById(ctx.user_id, req.params.notification_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  }));

  const handleMarkNotificationRead = asyncRoute(async (req, res) => {
    const ctx = context(req);
    if (!notificationService) {
      throw new NotImplementedError('Notification updates are not available in the current runtime');
    }
    const data = await notificationService.markAsRead(ctx.user_id, req.params.notification_id);
    res.json(buildSuccessEnvelope(data, requestId(req)));
  });

  router.patch('/notifications/:notification_id/read', ...guards(auth, 'BUYER'), handleMarkNotificationRead);
  router.patch('/notifications/:notification_id', ...guards(auth, 'BUYER'), handleMarkNotificationRead);

  return router;
}
