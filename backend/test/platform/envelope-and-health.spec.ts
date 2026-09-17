import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import {
  buildSuccessEnvelope,
  buildPaginatedEnvelope,
  buildErrorEnvelope
} from '../../src/platform/http/envelope.ts';
import { isValidRequestId } from '../../src/platform/http/middlewares/request-id.ts';

describe('Phase 2 — Platform HTTP Envelope, Health & Request ID', () => {
  describe('Helper Envelope Functions', () => {
    it('[API-ENV-05] buildSuccessEnvelope returns standard data and request_id envelope', () => {
      const data = { hello: 'world' };
      const envelope = buildSuccessEnvelope(data, 'req_test_1234');
      assert.deepStrictEqual(envelope, {
        data: { hello: 'world' },
        request_id: 'req_test_1234'
      });
    });

    it('[API-ENV-05] buildPaginatedEnvelope returns standard paginated schema', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const meta = { next_cursor: 'cur_abc', has_more: true, limit: 10 };
      const envelope = buildPaginatedEnvelope(items, meta, 'req_test_1234');
      assert.deepStrictEqual(envelope, {
        data: items,
        meta: { next_cursor: 'cur_abc', has_more: true, limit: 10 },
        request_id: 'req_test_1234'
      });
    });

    it('[API-ENV-05] buildErrorEnvelope returns standard error envelope', () => {
      const envelope = buildErrorEnvelope('NOT_FOUND', 'Item not found', 'req_test_1234', { field: 'id' });
      assert.deepStrictEqual(envelope, {
        error: {
          code: 'NOT_FOUND',
          message: 'Item not found',
          details: { field: 'id' }
        },
        request_id: 'req_test_1234'
      });
    });
  });

  describe('Request ID Validation & Health Endpoint', () => {
    const app = createApp();

    it('[API-ENV-01] GET /api/v1/health returns 200, json charset=utf-8, data and request_id', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200)
        .expect('Content-Type', /application\/json;\s*charset=utf-8/);

      assert.strictEqual(typeof res.body.data.status, 'string');
      assert.strictEqual(res.body.data.status, 'ok');
      assert.strictEqual(typeof res.body.data.timestamp, 'string');
      assert.strictEqual(typeof res.body.request_id, 'string');
      assert.ok(isValidRequestId(res.body.request_id));
      assert.strictEqual(res.headers['x-request-id'], res.body.request_id);
    });

    it('[API-ENV-02] preserves valid incoming X-Request-ID header in response and envelope', async () => {
      const customId = 'req_custom_id_123456';
      const res = await request(app)
        .get('/api/v1/health')
        .set('X-Request-ID', customId)
        .expect(200);

      assert.strictEqual(res.body.request_id, customId);
      assert.strictEqual(res.headers['x-request-id'], customId);
    });

    it('[API-ENV-03] generates new req_<uuid> when X-Request-ID header is missing', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .expect(200);

      assert.ok(res.body.request_id.startsWith('req_'));
      assert.ok(isValidRequestId(res.body.request_id));
      assert.strictEqual(res.headers['x-request-id'], res.body.request_id);
    });

    it('[API-ENV-04] rejects invalid X-Request-ID format (injection/special chars/length) and generates new req_<uuid>', async () => {
      const invalidIds = [
        '<script>alert(1)</script>',
        'short',
        'req_',
        'req_' + 'a'.repeat(70),
        'req_hello$world',
        '   ',
        'req_with space'
      ];

      for (const badId of invalidIds) {
        const res = await request(app)
          .get('/api/v1/health')
          .set('X-Request-ID', badId)
          .expect(200);

        assert.notStrictEqual(res.body.request_id, badId, `Should have rejected bad id: ${badId}`);
        assert.ok(res.body.request_id.startsWith('req_'));
        assert.ok(isValidRequestId(res.body.request_id));
        assert.strictEqual(res.headers['x-request-id'], res.body.request_id);
      }
    });
  });
});
