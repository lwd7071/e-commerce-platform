import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { createLayeredRateLimiter } from '../../src/platform/http/middlewares/rate-limiter.ts';
import { RateLimitExceededError } from '../../src/platform/errors/app-error.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';

describe('Layered Rate Limiter Middleware (Phase 2)', () => {
  it('[RATE-01]: allows requests within rate limit and attaches standard RateLimit headers', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 5 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    const res1 = await request(testApp).get('/test').expect(200);
    assert.strictEqual(res1.headers['ratelimit-limit'], '5');
    assert.strictEqual(res1.headers['ratelimit-remaining'], '4');
    assert.ok(res1.headers['ratelimit-reset'] !== undefined);

    const res2 = await request(testApp).get('/test').expect(200);
    assert.strictEqual(res2.headers['ratelimit-remaining'], '3');
  });

  it('[RATE-02]: returns 429 with RATE_LIMIT_EXCEEDED error envelope when limit is exceeded', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 2 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    await request(testApp).get('/test').expect(200);
    await request(testApp).get('/test').expect(200);

    const resBlocked = await request(testApp).get('/test').expect(429);
    assert.strictEqual(resBlocked.body.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(resBlocked.body.error.message.includes('Too many requests'));
    assert.ok(resBlocked.body.request_id !== undefined);
  });

  it('[RATE-03]: sets Retry-After header and RateLimit-Reset when rate limit is exceeded', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 5_000, max: 1 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    await request(testApp).get('/test').expect(200);

    const resLimited = await request(testApp).get('/test').expect(429);
    assert.ok(resLimited.headers['retry-after'] !== undefined);
    const retryAfter = Number(resLimited.headers['retry-after']);
    assert.ok(retryAfter >= 1 && retryAfter <= 5);
    assert.strictEqual(resLimited.headers['ratelimit-remaining'], '0');
  });

  it('[RATE-04]: applies stricter tiered rate limit to sensitive routes (e.g. checkout)', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 5 },
      sensitiveTiers: [
        { pattern: /^\/api\/v1\/checkout/, windowMs: 10_000, max: 2 }
      ]
    }));
    testApp.get('/api/v1/catalog', (_req, res) => res.json({ ok: true }));
    testApp.post('/api/v1/checkout', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    // Standard route allows 5 requests
    await request(testApp).get('/api/v1/catalog').expect(200);
    await request(testApp).get('/api/v1/catalog').expect(200);
    await request(testApp).get('/api/v1/catalog').expect(200);

    // Sensitive route allows only 2
    await request(testApp).post('/api/v1/checkout').expect(200);
    await request(testApp).post('/api/v1/checkout').expect(200);
    const resBlocked = await request(testApp).post('/api/v1/checkout').expect(429);
    assert.strictEqual(resBlocked.body.error.code, 'RATE_LIMIT_EXCEEDED');

    // Standard route still works (since it has higher limit & separate tier/counter)
    await request(testApp).get('/api/v1/catalog').expect(200);
  });

  it('[RATE-05]: resets counter after the sliding window expires', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 100, max: 1 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    await request(testApp).get('/test').expect(200);
    await request(testApp).get('/test').expect(429);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const resAfterReset = await request(testApp).get('/test').expect(200);
    assert.strictEqual(resAfterReset.headers['ratelimit-remaining'], '0');
  });

  it('[RATE-06]: integrated in default createApp() with RateLimit headers', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['ratelimit-limit'] !== undefined);
    assert.ok(res.headers['ratelimit-remaining'] !== undefined);
  });

  it('[RATE-07]: rejects rate limit bypass attempts via spoofed X-Forwarded-For headers when trust proxy is false', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 1 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    // Request 1 from client with spoofed header
    await request(testApp)
      .get('/test')
      .set('X-Forwarded-For', '203.0.113.195')
      .expect(200);

    // Request 2 from same client/socket with a different spoofed header
    // When trust proxy is false, Express must ignore X-Forwarded-For and block this request
    const resBlocked = await request(testApp)
      .get('/test')
      .set('X-Forwarded-For', '198.51.100.24')
      .expect(429);

    assert.strictEqual(resBlocked.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('[RATE-08]: properly respects trust proxy = 1 and resists multi-hop spoofing', async () => {
    const testApp = express();
    // Best practice: trust exactly 1 hop (the immediate reverse proxy / ALB)
    testApp.set('trust proxy', 1);
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 1 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    // Subtest 8A: Client sends single valid forwarded IP from trusted 1-hop proxy
    await request(testApp)
      .get('/test')
      .set('X-Forwarded-For', '203.0.113.195')
      .expect(200);

    // Subtest 8B: Client attempts multi-hop spoofing "1.1.1.1, 203.0.113.195".
    // With trust proxy = 1, Express correctly picks the trusted 1-hop IP (203.0.113.195),
    // which matches the existing bucket and is blocked with 429
    const resBlocked = await request(testApp)
      .get('/test')
      .set('X-Forwarded-For', '1.1.1.1, 203.0.113.195')
      .expect(429);

    assert.strictEqual(resBlocked.body.error.code, 'RATE_LIMIT_EXCEEDED');
  });

  it('[RATE-09]: handles concurrent requests accurately without counter race conditions in memory store', async () => {
    const testApp = express();
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 10 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    // Fire 20 concurrent requests
    const promises = Array.from({ length: 20 }, () => request(testApp).get('/test'));
    const results = await Promise.all(promises);

    const okCount = results.filter((r) => r.status === 200).length;
    const rateLimitedCount = results.filter((r) => r.status === 429).length;

    assert.strictEqual(okCount, 10, 'Expected exactly 10 requests to succeed');
    assert.strictEqual(rateLimitedCount, 10, 'Expected exactly 10 requests to be rate-limited');
  });

  it('[RATE-10]: fail-safe rejects request with 400 CLIENT_IP_REQUIRED when req.ip cannot be determined', async () => {
    const testApp = express();
    // Simulate an environment where req.ip cannot be resolved
    testApp.use((req, _res, next) => {
      Object.defineProperty(req, 'ip', { value: undefined, configurable: true });
      next();
    });
    testApp.use(createLayeredRateLimiter({
      defaultTier: { windowMs: 10_000, max: 5 },
      sensitiveTiers: []
    }));
    testApp.get('/test', (_req, res) => res.json({ ok: true }));
    testApp.use(errorHandlerMiddleware);

    const res = await request(testApp).get('/test').expect(400);
    assert.strictEqual(res.body.error.code, 'CLIENT_IP_REQUIRED');
  });
});
