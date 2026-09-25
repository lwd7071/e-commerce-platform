import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError, RateLimitExceededError } from '../../errors/app-error.ts';
import { buildErrorEnvelope } from '../envelope.ts';
import { logger } from '../../logging/logger.ts';

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.requestId || 'req_unknown';

  // 1. Handle malformed JSON body from express.json parser
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400 && 'body' in err) {
    logger.warn('Malformed JSON body in request', {
      request_id: requestId,
      method: req.method,
      route: req.path,
      status: 400,
      error_code: 'INVALID_REQUEST'
    });

    res.status(400).json(
      buildErrorEnvelope('INVALID_REQUEST', 'Malformed JSON body', requestId)
    );
    return;
  }

  // 2. Handle standard application errors (AppError)
  if (err instanceof AppError) {
    if (err instanceof RateLimitExceededError && err.retryAfterSeconds !== undefined) {
      if (!res.getHeader('Retry-After')) {
        res.setHeader('Retry-After', String(err.retryAfterSeconds));
      }
    }

    const level = err.httpStatus >= 500 ? 'error' : 'warn';
    logger[level](err.message, {
      request_id: requestId,
      method: req.method,
      route: req.path,
      status: err.httpStatus,
      error_code: err.code
    });

    res.status(err.httpStatus).json(
      buildErrorEnvelope(err.code, err.message, requestId, err.details)
    );
    return;
  }

  // 3. Handle service dependency / connection pool failures (57P01, ECONNREFUSED, timeout, etc.)
  const maybeErr = err as { code?: unknown; message?: unknown };
  const errCode = typeof maybeErr?.code === 'string' ? maybeErr.code : '';
  const errMsg = typeof maybeErr?.message === 'string' ? maybeErr.message : (err instanceof Error ? err.message : '');

  const isDependencyDown =
    ['57P01', '57P02', '57P03', '08000', '08003', '08006', 'ECONNREFUSED', 'ETIMEDOUT'].includes(errCode) ||
    /connection (?:terminated|timeout|refused)|timeout exceeded when connecting to database/i.test(errMsg);

  if (isDependencyDown) {
    const code = 'DEPENDENCY_UNAVAILABLE';
    const message = 'Database dependency is temporarily unavailable';
    logger.error(message, {
      request_id: requestId,
      method: req.method,
      route: req.path,
      status: 503,
      error_code: code
    });
    res.status(503).json(buildErrorEnvelope(code, message, requestId));
    return;
  }

  // 4. Handle PostgreSQL database errors (code 23505, 23503, 23514, etc.)
  const maybePg = err as { code?: unknown; constraint?: unknown; detail?: unknown; message?: unknown };
  if (maybePg && typeof maybePg.code === 'string') {
    // Unique violation (23505)
    if (maybePg.code === '23505') {
      const constraint = String(maybePg.constraint || '');
      let code = 'RESOURCE_CONFLICT';
      let message = 'A unique constraint violation occurred.';
      if (constraint.includes('app_users__email')) {
        code = 'USER_EMAIL_CONFLICT';
        message = 'Email already exists.';
      } else if (constraint.includes('shops__owner_id') || constraint.includes('shops')) {
        code = 'SHOP_ALREADY_EXISTS';
        message = 'User already has a shop.';
      } else if (constraint.includes('vouchers__code')) {
        code = 'VOUCHER_CODE_CONFLICT';
        message = 'Voucher code already exists.';
      } else if (constraint.includes('product_variants__sku')) {
        code = 'SKU_CONFLICT';
        message = 'SKU already exists in this shop.';
      }

      logger.warn(message, {
        request_id: requestId,
        method: req.method,
        route: req.path,
        status: 409,
        error_code: code
      });

      res.status(409).json(buildErrorEnvelope(code, message, requestId));
      return;
    }

    // Foreign key violation (23503)
    if (maybePg.code === '23503') {
      const detailStr = `${String(maybePg.message || '')} ${String(maybePg.detail || '')}`;
      const isDeleteViolation = /delete|update or delete|still referenced/i.test(detailStr);

      if (isDeleteViolation) {
        const code = 'RESOURCE_DELETE_NOT_ALLOWED';
        const message = 'Resource cannot be deleted because dependent records exist.';
        logger.warn(message, {
          request_id: requestId,
          method: req.method,
          route: req.path,
          status: 409,
          error_code: code
        });
        res.status(409).json(buildErrorEnvelope(code, message, requestId));
        return;
      }

      const code = 'RESOURCE_NOT_FOUND';
      const message = 'Referenced resource was not found.';
      logger.warn(message, {
        request_id: requestId,
        method: req.method,
        route: req.path,
        status: 404,
        error_code: code
      });
      res.status(404).json(buildErrorEnvelope(code, message, requestId));
      return;
    }

    // Check constraint violation (23514)
    if (maybePg.code === '23514') {
      const code = 'VALIDATION_FAILED';
      const message = 'Data constraint validation failed.';
      logger.warn(message, {
        request_id: requestId,
        method: req.method,
        route: req.path,
        status: 422,
        error_code: code
      });
      res.status(422).json(buildErrorEnvelope(code, message, requestId));
      return;
    }
  }

  // 4. Handle Domain & Contract Errors (Buyer, Order, Checkout)
  const maybeDomain = err as { code?: unknown; details?: unknown; message?: unknown; name?: unknown };
  if (
    err instanceof Error &&
    typeof maybeDomain.code === 'string' &&
    maybeDomain.code !== 'INTERNAL_ERROR' &&
    !/^\d{5}$/.test(maybeDomain.code)
  ) {
    const code = maybeDomain.code;
    const details = maybeDomain.details;
    const message = err.message;

    let httpStatus = 400;
    if (
      code === 'VALIDATION_FAILED' ||
      code === 'REASON_REQUIRED' ||
      code === 'VOUCHER_NOT_APPLICABLE' ||
      code === 'REVIEW_NOT_ELIGIBLE' ||
      code === 'PAYMENT_AMOUNT_INVALID'
    ) {
      httpStatus = 422;
    } else if (code === 'RESOURCE_NOT_FOUND') {
      httpStatus = 404;
    } else if (code === 'RESOURCE_FORBIDDEN') {
      httpStatus = 403;
    } else if (
      code === 'CONFLICT' ||
      code === 'RESOURCE_CONFLICT' ||
      code === 'CART_CONFLICT' ||
      code === 'CART_ITEM_CONFLICT' ||
      code === 'DEFAULT_ADDRESS_CONFLICT' ||
      code === 'INVENTORY_INSUFFICIENT' ||
      code === 'REVIEW_ALREADY_EXISTS' ||
      code === 'INVALID_STATE_TRANSITION' ||
      code === 'ORDER_INVALID_TRANSITION' ||
      code === 'ORDER_CANCELLATION_NOT_ALLOWED' ||
      code === 'PAYMENT_STATE_INVALID' ||
      code === 'PAYMENT_ALREADY_COMPLETED' ||
      code === 'IDEMPOTENCY_KEY_REUSED' ||
      code === 'REQUEST_IN_PROGRESS'
    ) {
      httpStatus = 409;
    } else if (code === 'DEPENDENCY_UNAVAILABLE') {
      httpStatus = 503;
    } else if (code === 'IDEMPOTENCY_KEY_REQUIRED' || code === 'INVALID_REQUEST') {
      httpStatus = 400;
    }

    logger.warn(message, {
      request_id: requestId,
      method: req.method,
      route: req.path,
      status: httpStatus,
      error_code: code
    });

    res.status(httpStatus).json(
      buildErrorEnvelope(code, message, requestId, details)
    );
    return;
  }

  // 4. Handle unexpected / unhandled runtime errors
  // Quality gate: NEVER leak stack trace, SQL errors, or DB credentials to client
  const actualError = err instanceof Error ? err : new Error(String(err));
  logger.error(actualError.message, {
    request_id: requestId,
    method: req.method,
    route: req.path,
    status: 500,
    error_code: 'INTERNAL_ERROR',
    stack: actualError.stack
  });

  res.status(500).json(
    buildErrorEnvelope('INTERNAL_ERROR', 'An internal error occurred', requestId)
  );
};
