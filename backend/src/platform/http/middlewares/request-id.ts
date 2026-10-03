import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_REGEX = /^req_[a-zA-Z0-9_-]{4,60}$/;

export function isValidRequestId(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  return REQUEST_ID_REGEX.test(id);
}

export function generateRequestId(): string {
  return `req_${uuidv4()}`;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingHeader = req.header('X-Request-ID');
  let finalRequestId: string;

  if (isValidRequestId(incomingHeader)) {
    finalRequestId = incomingHeader as string;
  } else {
    finalRequestId = generateRequestId();
  }

  req.requestId = finalRequestId;
  res.setHeader('X-Request-ID', finalRequestId);
  next();
}
