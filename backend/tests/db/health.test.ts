import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { checkDatabaseHealth } from '../../db/health.js';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { createDatabasePool, closeDatabasePool } from '../../db/client.js';

describe('Database Health Check', () => {
  it('returns healthy status with latency and pool metrics when probe succeeds', async () => {
    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ probe: 1 }] }),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    } as unknown as Pool;

    const result = await checkDatabaseHealth(mockPool);

    expect(result.status).toBe('healthy');
    expect(typeof result.latencyMs).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.pool).toEqual({
      totalCount: 5,
      idleCount: 3,
      waitingCount: 0,
    });
    expect(result.error).toBeUndefined();
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns unhealthy status when database probe query fails', async () => {
    const mockClient = {
      query: vi.fn().mockRejectedValue(new Error('Connection lost')),
      release: vi.fn(),
    } as unknown as PoolClient;

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      totalCount: 1,
      idleCount: 0,
      waitingCount: 2,
    } as unknown as Pool;

    const result = await checkDatabaseHealth(mockPool);

    expect(result.status).toBe('unhealthy');
    expect(result.error).toContain('Connection lost');
    expect(result.pool).toEqual({
      totalCount: 1,
      idleCount: 0,
      waitingCount: 2,
    });
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('returns unhealthy status when connection times out', async () => {
    const mockPool = {
      connect: vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500))),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 1,
    } as unknown as Pool;

    const result = await checkDatabaseHealth(mockPool, { timeoutMs: 50 });

    expect(result.status).toBe('unhealthy');
    expect(result.error).toMatch(/timed out|timeout/i);
  });
});

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('Database Health Check Remote Integration', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 1 } });
  }, 30_000);

  afterAll(async () => {
    if (pool) await closeDatabasePool(pool);
  });

  it('reports healthy on live database connection', async () => {
    if (!pool) throw new Error('Pool not initialized');
    const result = await checkDatabaseHealth(pool);
    expect(result.status).toBe('healthy');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  }, 15_000);
});

