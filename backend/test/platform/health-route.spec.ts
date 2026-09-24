import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { createApp } from '../../src/platform/http/app.ts';

describe('Health Check Route Integration (/api/v1/health)', () => {
  it('returns ok status without database metrics when no pool is configured', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health').expect(200);

    assert.strictEqual(res.body.data.status, 'ok');
    assert.strictEqual(typeof res.body.data.timestamp, 'string');
    assert.strictEqual(res.body.data.database, undefined);
    assert.ok(res.body.request_id);
  });

  it('measures probe latency and pool metrics when healthy pool is configured', async () => {
    const mockClient = {
      query: async (queryText: string) => {
        if (queryText.includes('SELECT 1')) {
          return { rows: [{ probe: 1 }] };
        }
        return { rows: [] };
      },
      release: () => {},
    } as unknown as PoolClient;

    const mockPool = {
      connect: async () => mockClient,
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0,
    } as unknown as Pool;

    const app = createApp({ pool: mockPool });
    const res = await request(app).get('/api/v1/health').expect(200);

    assert.strictEqual(res.body.data.status, 'ok');
    assert.ok(res.body.data.database);
    assert.strictEqual(res.body.data.database.status, 'healthy');
    assert.strictEqual(typeof res.body.data.database.latency_ms, 'number');
    assert.deepStrictEqual(res.body.data.database.pool, {
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0,
    });
    assert.strictEqual(typeof res.body.data.timestamp, 'string');
    assert.ok(res.body.request_id);
  });

  it('returns 503 degraded status when database probe query fails', async () => {
    const mockClient = {
      query: async () => {
        throw new Error('Connection refused to PostgreSQL');
      },
      release: () => {},
    } as unknown as PoolClient;

    const mockPool = {
      connect: async () => mockClient,
      totalCount: 1,
      idleCount: 0,
      waitingCount: 3,
    } as unknown as Pool;

    const app = createApp({ pool: mockPool });
    const res = await request(app).get('/api/v1/health').expect(503);

    assert.strictEqual(res.body.data.status, 'degraded');
    assert.ok(res.body.data.database);
    assert.strictEqual(res.body.data.database.status, 'unhealthy');
    assert.ok(res.body.data.database.error.includes('Connection refused'));
    assert.deepStrictEqual(res.body.data.database.pool, {
      totalCount: 1,
      idleCount: 0,
      waitingCount: 3,
    });
  });
});
