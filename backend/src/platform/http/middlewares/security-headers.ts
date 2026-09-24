import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface CorsOptions {
  allowedOrigins?: string[];
  allowedMethods?: string[];
  allowedHeaders?: string[];
  maxAge?: number;
}

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Request-ID', 'Idempotency-Key'];

/**
 * Creates middleware to set OWASP recommended security headers and remove server fingerprint.
 */
export function createSecurityHeadersMiddleware(): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    // Remove Express fingerprint
    res.removeHeader('X-Powered-By');

    // Strict MIME-type sniffing prevention
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Clickjacking protection
    res.setHeader('X-Frame-Options', 'DENY');

    // HSTS (1 year + subdomains)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

    // XSS filter configuration (modern zero/disable to prevent XS-leaks)
    res.setHeader('X-XSS-Protection', '0');

    // Cross-Origin Isolations
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    next();
  };
}

/**
 * Creates configurable CORS middleware validating Origin against whitelist.
 */
export function createCorsMiddleware(options: CorsOptions = {}): RequestHandler {
  const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedOrigins = options.allowedOrigins ?? (
    envOrigins.length > 0 ? envOrigins : ['http://localhost:3000', 'http://127.0.0.1:3000']
  );

  const allowedMethods = options.allowedMethods ?? DEFAULT_ALLOWED_METHODS;
  const allowedHeaders = options.allowedHeaders ?? DEFAULT_ALLOWED_HEADERS;
  const maxAge = options.maxAge ?? 86400;

  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', allowedMethods.join(', '));
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.setHeader('Access-Control-Max-Age', String(maxAge));
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}
