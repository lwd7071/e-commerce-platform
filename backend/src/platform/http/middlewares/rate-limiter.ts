import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { RateLimitExceededError } from '../../errors/app-error.ts';

export interface RateLimitTierConfig {
  windowMs: number;
  max: number;
}

export interface SensitiveRouteTierConfig {
  pattern: RegExp | string;
  windowMs?: number;
  max: number;
}

export interface RateLimiterOptions {
  defaultTier?: RateLimitTierConfig;
  sensitiveTiers?: SensitiveRouteTierConfig[];
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface ClientRecord {
  timestamps: number[];
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

  const keyGenerator =
    options.keyGenerator ??
    ((req: Request): string => {
      return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        req.socket.remoteAddress ||
        '127.0.0.1'
      );
    });

  // Store: Map<bucketKey, ClientRecord>
  const store = new Map<string, ClientRecord>();

  // Cleanup interval: prune keys with no timestamps in the last 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      // Remove timestamps older than 5 minutes
      record.timestamps = record.timestamps.filter((t) => now - t < 300_000);
      if (record.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60_000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skip && options.skip(req)) {
      next();
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

    const clientIp = keyGenerator(req);
    const bucketKey = `${tierPrefix}:${clientIp}`;
    const now = Date.now();

    let record = store.get(bucketKey);
    if (!record) {
      record = { timestamps: [] };
      store.set(bucketKey, record);
    }

    // Prune timestamps outside current window
    const windowStart = now - tierWindowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    // Calculate reset epoch (seconds)
    const oldestTimestamp = record.timestamps[0] ?? now;
    const resetTimeMs = oldestTimestamp + tierWindowMs;
    const resetEpochSeconds = Math.ceil(resetTimeMs / 1000);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));

    res.setHeader('RateLimit-Limit', String(tierMax));

    if (record.timestamps.length >= tierMax) {
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

    // Record this request
    record.timestamps.push(now);
    const remaining = tierMax - record.timestamps.length;
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(resetEpochSeconds));

    next();
  };
}
