import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { buildSuccessEnvelope } from '../http/envelope.ts';
import { checkDatabaseHealth } from '../../../db/health.ts';

export function createHealthRouter(pool?: Pool): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const requestId = req.requestId || 'req_unknown';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!pool) {
      res.status(200).json(
        buildSuccessEnvelope(
          {
            status: 'ok',
            timestamp: new Date().toISOString(),
          },
          requestId
        )
      );
      return;
    }

    try {
      const dbHealth = await checkDatabaseHealth(pool);
      if (dbHealth.status === 'healthy') {
        res.status(200).json(
          buildSuccessEnvelope(
            {
              status: 'ok',
              database: {
                status: dbHealth.status,
                latency_ms: dbHealth.latencyMs,
                pool: dbHealth.pool,
              },
              timestamp: dbHealth.timestamp,
            },
            requestId
          )
        );
      } else {
        res.status(503).json(
          buildSuccessEnvelope(
            {
              status: 'degraded',
              database: {
                status: dbHealth.status,
                latency_ms: dbHealth.latencyMs,
                pool: dbHealth.pool,
                error: dbHealth.error,
              },
              timestamp: dbHealth.timestamp,
            },
            requestId
          )
        );
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      res.status(503).json(
        buildSuccessEnvelope(
          {
            status: 'degraded',
            database: {
              status: 'unhealthy',
              latency_ms: 0,
              pool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
              error: errorMessage,
            },
            timestamp: new Date().toISOString(),
          },
          requestId
        )
      );
    }
  });

  return router;
}

export const healthRouter: Router = createHealthRouter();
