import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { metricsCollector, MetricsCollector } from './metrics.ts';

export function createMetricsMiddleware(collector: MetricsCollector = metricsCollector): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = performance.now();

    res.on('finish', () => {
      const durationMs = performance.now() - startTime;
      const route = req.baseUrl
        ? `${req.baseUrl}${req.route?.path || req.path}`
        : (req.route?.path || req.path);

      // Extract error code if set on res.locals
      const errorCode = (res.locals?.errorCode as string | undefined);

      collector.recordRequest(req.method, route, res.statusCode, durationMs, errorCode);
    });

    next();
  };
}
