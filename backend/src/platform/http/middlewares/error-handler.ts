import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../../errors/app-error.ts';
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

  // 3. Handle unexpected / unhandled runtime errors
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
