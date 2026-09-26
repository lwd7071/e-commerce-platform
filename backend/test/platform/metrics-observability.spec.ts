import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { MetricsCollector } from '../../src/platform/observability/metrics.ts';
import { createMetricsMiddleware } from '../../src/platform/observability/metrics-middleware.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';

describe('Metrics Collector & Observability (Phase 4A)', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('[METRIC-01]: records request counts by status, method, and route template', () => {
    collector.recordRequest('GET', '/api/v1/catalog', 200, 15.2);
    collector.recordRequest('GET', '/api/v1/catalog', 200, 12.0);
    collector.recordRequest('POST', '/api/v1/orders', 201, 45.6);
    collector.recordRequest('GET', '/api/v1/catalog', 404, 5.1, 'RESOURCE_NOT_FOUND');

    const snapshot = collector.getSnapshot();
    assert.strictEqual(snapshot.totalRequests, 4);
    assert.strictEqual(snapshot.totalErrors, 1);
    assert.strictEqual(snapshot.requestsByStatus[200], 2);
    assert.strictEqual(snapshot.requestsByStatus[201], 1);
    assert.strictEqual(snapshot.requestsByStatus[404], 1);
    assert.strictEqual(snapshot.requestsByRoute['GET /api/v1/catalog'], 3);
    assert.strictEqual(snapshot.requestsByRoute['POST /api/v1/orders'], 1);
    assert.strictEqual(snapshot.errorsByCode['RESOURCE_NOT_FOUND'], 1);
  });

  it('[METRIC-02]: calculates latency summary percentiles (p50, p95, p99)', () => {
    for (let i = 1; i <= 100; i++) {
      collector.recordRequest('GET', '/api/v1/health', 200, i);
    }

    const snapshot = collector.getSnapshot();
    assert.strictEqual(snapshot.latency.count, 100);
    assert.strictEqual(snapshot.latency.min, 1);
    assert.strictEqual(snapshot.latency.max, 100);
    assert.ok(Math.abs(snapshot.latency.avg - 50.5) < 0.1);
    assert.strictEqual(snapshot.latency.p50, 50);
    assert.strictEqual(snapshot.latency.p95, 95);
    assert.strictEqual(snapshot.latency.p99, 99);
  });

  it('[METRIC-03]: metrics middleware tracks incoming requests on express app', async () => {
    const testApp = express();
    testApp.use(createMetricsMiddleware(collector));
    testApp.get('/test-route', (_req, res) => res.status(200).json({ ok: true }));

    await request(testApp).get('/test-route').expect(200);
    await request(testApp).get('/test-route').expect(200);

    const snapshot = collector.getSnapshot();
    assert.strictEqual(snapshot.totalRequests, 2);
    assert.strictEqual(snapshot.requestsByStatus[200], 2);
    assert.ok(snapshot.latency.count === 2);
  });

  it('[METRIC-04]: maps database connection pool failure to 503 DEPENDENCY_UNAVAILABLE', async () => {
    const testApp = express();
    testApp.get('/db-down', () => {
      const err = new Error('Connection terminated unexpectedly due to database server restart');
      (err as unknown as { code: string }).code = '57P01';
      throw err;
    });
    testApp.use(errorHandlerMiddleware);

    const res = await request(testApp).get('/db-down').expect(503);
    assert.strictEqual(res.body.error.code, 'DEPENDENCY_UNAVAILABLE');
    assert.ok(res.body.error.message.includes('unavailable') || res.body.error.message.includes('Database'));
  });

  it('[METRIC-05]: maps connection timeout / ECONNREFUSED to 503 DEPENDENCY_UNAVAILABLE', async () => {
    const testApp = express();
    testApp.get('/db-timeout', () => {
      const err = new Error('timeout exceeded when connecting to database pool');
      (err as unknown as { code: string }).code = 'ECONNREFUSED';
      throw err;
    });
    testApp.use(errorHandlerMiddleware);

    const res = await request(testApp).get('/db-timeout').expect(503);
    assert.strictEqual(res.body.error.code, 'DEPENDENCY_UNAVAILABLE');
  });
});
