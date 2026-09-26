import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppError, RateLimitExceededError } from '../../errors/app-error.ts';
import { logger } from '../../logging/logger.ts';

export interface RateLimitTierConfig {
  windowMs: number;
  max: number;
}

export interface SensitiveRouteTierConfig {
  pattern: RegExp | string;
  windowMs?: number;
  max: number;
}

export interface IRateLimitStore {
  hit(key: string, windowMs: number): Promise<{ count: number; oldestTimestamp: number }> | { count: number; oldestTimestamp: number };
  reset?(key: string): void;
}

export interface RateLimiterOptions {
  defaultTier?: RateLimitTierConfig;
  sensitiveTiers?: SensitiveRouteTierConfig[];
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  store?: IRateLimitStore;
}

interface ClientRecord {
  timestamps: number[];
}

export class MemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, ClientRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.store.entries()) {
        record.timestamps = record.timestamps.filter((t) => now - t < 300_000);
        if (record.timestamps.length === 0) {
          this.store.delete(key);
        }
      }
    }, 60_000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  hit(key: string, windowMs: number): { count: number; oldestTimestamp: number } {
    const now = Date.now();
    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.timestamps.push(now);

    return {
      count: record.timestamps.length,
      oldestTimestamp: record.timestamps[0] ?? now,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  close(): void {
    clearInterval(this.cleanupInterval);
  }
}

export function createLayeredRateLimiter(options: RateLimiterOptions = {}): RequestHandler {
  const defaultTier: RateLimitTierConfig = options.defaultTier ?? {
    windowMs: 60_000,
    max: 100,
  };

  const sensitiveTiers: SensitiveRouteTierConfig[] = options.sensitiveTiers ?? [
    { pattern: /^\/api\/v1\/checkout/, windowMs: 60_000, max: 20 },
    { pattern: /^\/api\/v1\/orders/, windowMs: 60_000, max: 30 },
  ];

  const store = options.store ?? new MemoryRateLimitStore();

  const keyGenerator =
    options.keyGenerator ??
    ((req: Request): string => {
      const clientIp = req.ip;
      if (!clientIp) {
        logger.warn('Unidentified client IP in rate limiter', {
          method: req.method,
          route: req.originalUrl || req.url,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
        throw new AppError(
          400,
          'CLIENT_IP_REQUIRED',
          'Unable to determine verified client IP for rate limiting'
        );
      }
      return clientIp;
    });

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skip && options.skip(req)) {
      next();
      return;
    }

    let clientIp: string;
    try {
      clientIp = keyGenerator(req);
    } catch (err) {
      next(err);
      return;
    }

    const path = req.path || req.url;
    let tierMax = defaultTier.max;
    let tierWindowMs = defaultTier.windowMs;
    let tierPrefix = 'default';

    // Check sensitive routes
    for (let i = 0; i < sensitiveTiers.length; i++) {
      const sensitive = sensitiveTiers[i];
      const matches =
        typeof sensitive.pattern === 'string'
          ? path.startsWith(sensitive.pattern)
          : sensitive.pattern.test(path);

      if (matches) {
        tierMax = sensitive.max;
        tierWindowMs = sensitive.windowMs ?? defaultTier.windowMs;
        tierPrefix = `sensitive_${i}`;
        break;
      }
    }

    const bucketKey = `${tierPrefix}:${clientIp}`;
    const now = Date.now();

    const hitResult = store.hit(bucketKey, tierWindowMs);
    const processResult = (result: { count: number; oldestTimestamp: number }) => {
      const resetTimeMs = result.oldestTimestamp + tierWindowMs;
      const resetEpochSeconds = Math.ceil(resetTimeMs / 1000);
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

      res.setHeader('RateLimit-Limit', String(tierMax));

      if (result.count > tierMax) {
        res.setHeader('RateLimit-Remaining', '0');
        res.setHeader('RateLimit-Reset', String(resetEpochSeconds));
        res.setHeader('Retry-After', String(retryAfterSeconds));

        next(
          new RateLimitExceededError(
            `Too many requests, please try again later. Limit: ${tierMax} requests per ${Math.round(
              tierWindowMs / 1000
            )}s`,
            retryAfterSeconds
          )
        );
        return;
      }

      const remaining = Math.max(0, tierMax - result.count);
      res.setHeader('RateLimit-Remaining', String(remaining));
      res.setHeader('RateLimit-Reset', String(resetEpochSeconds));

      next();
    };

    if (hitResult instanceof Promise) {
      hitResult.then(processResult).catch(next);
    } else {
      processResult(hitResult);
    }
  };
}
