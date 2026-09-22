import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../../modules/identity/domain/types.ts';
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError
} from '../../errors/app-error.ts';

/**
 * Role Guard Middleware: Enforces that the request context has one of the allowed roles.
 * Unauthenticated requests (missing context) trigger 401 AUTH_REQUIRED.
 * Wrong role triggers 403 RESOURCE_FORBIDDEN.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required. Missing request context.');
    }

    if (!allowedRoles.includes(req.context.role)) {
      throw new ForbiddenError(
        'RESOURCE_FORBIDDEN',
        `Access forbidden for role '${req.context.role}'. Required one of: ${allowedRoles.join(', ')}`
      );
    }

    next();
  };
}

/**
 * Buyer Ownership Guard: Enforces that Buyer can only access their own private resources.
 * If user is ADMIN -> bypass.
 * If targetUserId !== req.context.user_id -> 404 RESOURCE_NOT_FOUND to prevent resource enumeration per auth-rbac-rls.md §3.
 */
export function requireBuyerOwnership(getTargetUserId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required.');
    }

    if (req.context.role === 'ADMIN') {
      return next();
    }

    const targetUserId = getTargetUserId(req);
    if (!targetUserId || req.context.user_id !== targetUserId) {
      throw new NotFoundError('Resource not found');
    }

    next();
  };
}

/**
 * Seller Shop Ownership Guard: Enforces that Seller can only access their own shop resources.
 * If user is ADMIN -> bypass.
 * If user is not SELLER or shop_id mismatch -> 403 RESOURCE_FORBIDDEN per auth-rbac-rls.md §3.
 */
export function requireShopOwnership(getTargetShopId: (req: Request) => string | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required.');
    }

    if (req.context.role === 'ADMIN') {
      return next();
    }

    if (req.context.role !== 'SELLER') {
      throw new ForbiddenError(
        'RESOURCE_FORBIDDEN',
        'Access forbidden: only sellers or admins may access shop-scoped resources.'
      );
    }

    const targetShopId = getTargetShopId(req);
    if (!req.context.shop_id || req.context.shop_id !== targetShopId) {
      throw new ForbiddenError('RESOURCE_FORBIDDEN', 'Access forbidden: Shop ownership mismatch.');
    }

    next();
  };
}
