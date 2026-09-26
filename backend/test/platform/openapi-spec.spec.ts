import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { generateOpenApiSpec } from '../../src/platform/openapi/openapi-spec.ts';

describe('Draft OpenAPI 3.1 Spec Generation & RBAC Audit (Phase 5)', () => {
  it('[OAS-01]: GET /api/v1/openapi.json returns valid OpenAPI 3.1.0 document', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/openapi.json').expect(200);

    assert.strictEqual(res.body.openapi, '3.1.0');
    assert.ok(res.body.info);
    assert.strictEqual(res.body.info.title, 'E-Commerce Platform API');
    assert.ok(res.body.paths);
  });

  it('[OAS-02]: includes canonical audited routes with standard envelopes', () => {
    const spec = generateOpenApiSpec();

    // Health
    assert.ok(spec.paths['/api/v1/health']);
    assert.ok(spec.paths['/api/v1/health'].get);

    // Buyer Addresses (canonical route without /buyer prefix)
    assert.ok(spec.paths['/api/v1/addresses']);
    assert.ok(spec.paths['/api/v1/addresses'].get);
    assert.ok(spec.paths['/api/v1/addresses'].post);

    // Cart
    assert.ok(spec.paths['/api/v1/cart']);
    assert.ok(spec.paths['/api/v1/cart'].get);
    assert.ok(spec.paths['/api/v1/cart/items']);
    assert.ok(spec.paths['/api/v1/cart/items'].post);

    // Orders & Checkout
    assert.ok(spec.paths['/api/v1/checkout']);
    assert.ok(spec.paths['/api/v1/checkout'].post);
    assert.ok(spec.paths['/api/v1/orders']);
    assert.ok(spec.paths['/api/v1/orders'].get);
    assert.ok(spec.paths['/api/v1/orders'].post);
    assert.ok(spec.paths['/api/v1/orders/{order_id}']);
    assert.ok(spec.paths['/api/v1/orders/{order_id}'].get);
    assert.ok(spec.paths['/api/v1/orders/{order_id}/cancel']);
    assert.ok(spec.paths['/api/v1/orders/{order_id}/cancel'].post);

    // Reviews (canonical /order-items/:order_item_id/review)
    assert.ok(spec.paths['/api/v1/order-items/{order_item_id}/review']);
    assert.ok(spec.paths['/api/v1/order-items/{order_item_id}/review'].post);

    // Vouchers (canonical tested endpoints)
    assert.ok(spec.paths['/api/v1/vouchers'], 'Expected /api/v1/vouchers path to be present');
    assert.ok(spec.paths['/api/v1/vouchers'].get, 'Expected GET /api/v1/vouchers operation');
    assert.ok(spec.paths['/api/v1/vouchers/evaluate'], 'Expected /api/v1/vouchers/evaluate path to be present');
    assert.ok(spec.paths['/api/v1/vouchers/evaluate'].post, 'Expected POST /api/v1/vouchers/evaluate operation');

    // Notifications (canonical tested endpoints)
    assert.ok(spec.paths['/api/v1/notifications'], 'Expected /api/v1/notifications path to be present');
    assert.ok(spec.paths['/api/v1/notifications'].get, 'Expected GET /api/v1/notifications operation');
    assert.ok(spec.paths['/api/v1/notifications/{notification_id}/read'], 'Expected /api/v1/notifications/{notification_id}/read path to be present');
    assert.ok(spec.paths['/api/v1/notifications/{notification_id}/read'].patch, 'Expected PATCH /api/v1/notifications/{notification_id}/read operation');
  });

  it('[OAS-03]: intentionally excludes legacy alias routes and untested endpoints', () => {
    const spec = generateOpenApiSpec();

    // 1. PATCH /api/v1/cart/items/{cart_item_id} (pending route tests)
    assert.strictEqual(spec.paths['/api/v1/cart/items/{cart_item_id}'], undefined);

    // 2. GET /api/v1/notifications/{notification_id} (pending standalone route test)
    assert.strictEqual(spec.paths['/api/v1/notifications/{notification_id}'], undefined);

    // 3. POST /api/v1/reviews (legacy alias to /order-items/:id/review, deprecated)
    assert.strictEqual(spec.paths['/api/v1/reviews'], undefined);

    // 4. GET /api/v1/vouchers/preview (legacy alias to /vouchers/evaluate, deprecated)
    assert.strictEqual(spec.paths['/api/v1/vouchers/preview'], undefined);

    // 5. GET /api/v1/vouchers/applicable (legacy alias to /vouchers, deprecated)
    assert.strictEqual(spec.paths['/api/v1/vouchers/applicable'], undefined);

    // 6. POST /api/v1/orders/{order_id}/confirm (pending test coverage)
    assert.strictEqual(spec.paths['/api/v1/orders/{order_id}/confirm'], undefined);

    // 7. POST /api/v1/orders/{order_id}/transition (pending test coverage)
    assert.strictEqual(spec.paths['/api/v1/orders/{order_id}/transition'], undefined);

    // 8. POST /api/v1/orders/{order_id}/payments (pending test coverage)
    assert.strictEqual(spec.paths['/api/v1/orders/{order_id}/payments'], undefined);
  });

  it('[OAS-04]: components define standard ErrorEnvelope, SuccessEnvelope, and BearerAuth', () => {
    const spec = generateOpenApiSpec();

    assert.ok(spec.components);
    assert.ok(spec.components.schemas);
    assert.ok(spec.components.schemas['ErrorEnvelope']);
    assert.ok(spec.components.schemas['SuccessEnvelope']);
    assert.ok(spec.components.securitySchemes);
    assert.ok(spec.components.securitySchemes['BearerAuth']);
  });
});
