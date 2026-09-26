import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';

describe('Security Headers & CORS Policy Middleware (Phase 1)', () => {
  it('[SEC-HDR-01]: response carries required OWASP security headers', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual(res.headers['x-frame-options'], 'DENY');
    assert.strictEqual(res.headers['strict-transport-security'], 'max-age=31536000; includeSubDomains');
    assert.strictEqual(res.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
    assert.strictEqual(res.headers['x-xss-protection'], '0');
    assert.strictEqual(res.headers['cross-origin-opener-policy'], 'same-origin');
    assert.strictEqual(res.headers['cross-origin-resource-policy'], 'same-origin');
  });

  it('[SEC-HDR-02]: removes X-Powered-By header so Express internals are not leaked', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    assert.strictEqual(res.headers['x-powered-by'], undefined);
  });

  it('[SEC-HDR-03]: CORS preflight request with allowed origin returns 204 with required CORS headers', async () => {
    const app = createApp();
    const res = await request(app)
      .options('/api/v1/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization,X-Request-ID,Idempotency-Key')
      .expect(204);

    assert.strictEqual(res.headers['access-control-allow-origin'], 'http://localhost:3000');
    assert.ok(res.headers['access-control-allow-methods'].includes('POST'));
    assert.ok(res.headers['access-control-allow-headers'].includes('Content-Type'));
    assert.ok(res.headers['access-control-allow-headers'].includes('Idempotency-Key'));
  });

  it('[SEC-HDR-04]: request with disallowed foreign origin is rejected or denied CORS header', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://malicious-site.com');

    assert.strictEqual(res.headers['access-control-allow-origin'], undefined);
  });
});
