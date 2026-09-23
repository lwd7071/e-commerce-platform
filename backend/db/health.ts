import type { Pool, PoolClient } from 'pg';

export interface DatabasePoolMetrics {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface DatabaseHealthResult {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  pool: DatabasePoolMetrics;
  timestamp: string;
  error?: string;
}

export interface DatabaseHealthOptions {
  timeoutMs?: number;
}

/**
 * Kiểm tra kết nối và đo độ trễ truy vấn database.
 */
export async function checkDatabaseHealth(
  pool: Pool,
  options: DatabaseHealthOptions = {},
): Promise<DatabaseHealthResult> {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const start = performance.now();
  const timestamp = new Date().toISOString();

  const getMetrics = (): DatabasePoolMetrics => ({
    totalCount: pool.totalCount ?? 0,
    idleCount: pool.idleCount ?? 0,
    waitingCount: pool.waitingCount ?? 0,
  });

  let client: PoolClient | undefined;
  let timer: NodeJS.Timeout | undefined;

  try {
    const probePromise = (async () => {
      client = await pool.connect();
      await client.query('SELECT 1 AS probe');
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([probePromise, timeoutPromise]);
    const latencyMs = Math.round(performance.now() - start);

    return {
      status: 'healthy',
      latencyMs,
      pool: getMetrics(),
      timestamp,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: 'unhealthy',
      latencyMs,
      pool: getMetrics(),
      timestamp,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
    client?.release();
  }
}
