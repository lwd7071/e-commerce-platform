import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../src/platform/http/app.ts';
import { generateOpenApiSpec, resolveOperationUrl } from '../../src/platform/openapi/openapi-spec.ts';

interface ExpressRouterLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle?: { stack?: ExpressRouterLayer[] };
  regexp: { source: string };
}

interface ExpressWithRouter {
  _router: { stack: ExpressRouterLayer[] };
}

function getRegisteredExpressRoutes(app: Application): Set<string> {
  const routes = new Set<string>();
  const routerApp = app as unknown as ExpressWithRouter;

  for (const layer of routerApp._router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) routes.add(`${method.toUpperCase()} ${layer.route.path}`);
    } else if (layer.handle?.stack) {
      let mountPrefix = '';
      const source = layer.regexp.source;
      if (source.includes('\\/api\\/v1\\/health')) {
        mountPrefix = '/api/v1/health';
      } else if (source.includes('\\/api\\/v1')) {
        mountPrefix = '/api/v1';
      }

      for (const child of layer.handle.stack) {
        if (child.route) {
          const subPath = child.route.path === '/' && mountPrefix ? '' : child.route.path;
          for (const method of Object.keys(child.route.methods)) routes.add(`${method.toUpperCase()} ${mountPrefix}${subPath}`);
        }
      }
    }
  }

  return routes;
}

describe('Draft OpenAPI 3.1 Spec Generation & RBAC Audit (Phase 5)', () => {
  it('[OAS-01]: GET /api/v1/openapi.json returns valid OpenAPI 3.1.0 document', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/openapi.json').expect(200);

    assert.strictEqual(res.body.openapi, '3.1.0');
    assert.ok(res.body.info);
    assert.strictEqual(res.body.info.title, 'E-Commerce Platform API');
    assert.ok(res.body.servers);
    assert.strictEqual(res.body.servers[0].url, '/api/v1');
    assert.ok(res.body.paths);
  });

  it('[OAS-02]: includes canonical audited routes with standard envelopes', () => {
    const spec = generateOpenApiSpec();

    // Verify unified server URL
    assert.strictEqual(spec.servers[0].url, '/api/v1');

    // Health
    assert.ok(spec.paths['/health']);
    assert.ok(spec.paths['/health'].get);

    // Buyer Addresses (canonical route without /buyer prefix)
    assert.ok(spec.paths['/addresses']);
    assert.ok(spec.paths['/addresses'].get);
    assert.ok(spec.paths['/addresses'].post);
    assert.ok(spec.paths['/addresses/{address_id}']);
    assert.ok(spec.paths['/addresses/{address_id}'].patch);
    assert.ok(spec.paths['/addresses/{address_id}'].delete);
    assert.ok((spec.paths['/addresses/{address_id}'].delete as { responses?: Record<string, unknown> }).responses?.['204']);
    const addressRequest = (spec.paths['/addresses'].post as { requestBody?: { content?: Record<string, { schema?: { additionalProperties?: boolean } }> } }).requestBody;
    assert.equal(addressRequest?.content?.['application/json']?.schema?.additionalProperties, false);

    // Cart
    assert.ok(spec.paths['/cart']);
    assert.ok(spec.paths['/cart'].get);
    assert.ok(spec.paths['/cart/items']);
    assert.ok(spec.paths['/cart/items'].post);

    // Profile avatar upload contract accepts only a finalized media_id.
    assert.ok(spec.paths['/profile/avatar']?.patch);
    const avatarPatch = spec.paths['/profile/avatar'].patch as { requestBody?: { content?: Record<string, { schema?: { required?: string[]; additionalProperties?: boolean } }> } };
    assert.deepEqual(avatarPatch.requestBody?.content?.['application/json']?.schema?.required, ['media_id']);
    assert.equal(avatarPatch.requestBody?.content?.['application/json']?.schema?.additionalProperties, false);

    // Orders & Checkout
    assert.ok(spec.paths['/checkout']);
    assert.ok(spec.paths['/checkout'].post);
    assert.ok(spec.paths['/orders']);
    assert.ok(spec.paths['/orders'].get);
    assert.ok(spec.paths['/orders'].post);
    assert.ok(spec.paths['/orders/{order_id}']);
    assert.ok(spec.paths['/orders/{order_id}'].get);
    assert.ok(spec.paths['/orders/{order_id}/cancel']);
    assert.ok(spec.paths['/orders/{order_id}/cancel'].post);

    // Audited Order operations (confirm, transition, payments)
    assert.ok(spec.paths['/orders/{order_id}/confirm'], 'Expected /orders/{order_id}/confirm path to be present');
    assert.ok(spec.paths['/orders/{order_id}/confirm'].post, 'Expected POST /orders/{order_id}/confirm operation');
    assert.ok(spec.paths['/orders/{order_id}/transition'], 'Expected /orders/{order_id}/transition path to be present');
    assert.ok(spec.paths['/orders/{order_id}/transition'].post, 'Expected POST /orders/{order_id}/transition operation');
    assert.ok(spec.paths['/orders/{order_id}/payments'], 'Expected /orders/{order_id}/payments path to be present');
    assert.ok(spec.paths['/orders/{order_id}/payments'].post, 'Expected POST /orders/{order_id}/payments operation');
    const checkoutParameters = (spec.paths['/checkout'].post as { parameters?: Array<{ name: string }> }).parameters;
    assert.ok(checkoutParameters?.some(parameter => parameter.name === 'Idempotency-Key'));

    // Reviews (canonical /order-items/:order_item_id/review)
    assert.ok(spec.paths['/order-items/{order_item_id}/review']);
    assert.ok(spec.paths['/order-items/{order_item_id}/review'].post);

    // Vouchers (canonical tested endpoints)
    assert.ok(spec.paths['/vouchers'], 'Expected /vouchers path to be present');
    assert.ok(spec.paths['/vouchers'].get, 'Expected GET /vouchers operation');
    assert.ok(spec.paths['/vouchers/evaluate'], 'Expected /vouchers/evaluate path to be present');
    assert.ok(spec.paths['/vouchers/evaluate'].post, 'Expected POST /vouchers/evaluate operation');

    // Notifications (canonical tested endpoints)
    assert.ok(spec.paths['/notifications'], 'Expected /notifications path to be present');
    assert.ok(spec.paths['/notifications'].get, 'Expected GET /notifications operation');
    assert.ok(spec.paths['/notifications/{notification_id}/read'], 'Expected /notifications/{notification_id}/read path to be present');
    assert.ok(spec.paths['/notifications/{notification_id}/read'].patch, 'Expected PATCH /notifications/{notification_id}/read operation');
  });

  it('[OAS-03]: documents all mounted canonical routes and supported aliases', () => {
    const spec = generateOpenApiSpec();
    assert.ok(spec.paths['/cart/items/{cart_item_id}']?.patch);
    assert.ok(spec.paths['/notifications/{notification_id}']?.get);
    assert.ok(spec.paths['/reviews']?.post);
    assert.ok(spec.paths['/vouchers/preview']?.post);
    assert.ok(spec.paths['/vouchers/applicable']?.get);
  });

  it('[OAS-04]: components define standard ErrorEnvelope, SuccessEnvelope, and BearerAuth', () => {
    const spec = generateOpenApiSpec();

    assert.ok(spec.components);
    assert.ok(spec.components.schemas);
    assert.ok(spec.components.schemas['ErrorEnvelope']);
    assert.ok(spec.components.schemas['SuccessEnvelope']);
    assert.ok(spec.components.schemas['NotificationDTO']);
    assert.ok(spec.components.schemas['NotificationListEnvelope']);
    assert.ok(spec.components.securitySchemes);
    assert.ok(spec.components.securitySchemes['BearerAuth']);
  });

  it('[OAS-05]: verifies final resolved URLs for all operations have no duplicate prefix and match Express route patterns', () => {
    const spec = generateOpenApiSpec();
    const app = createApp();
    const expressRoutes = getRegisteredExpressRoutes(app);
    const serverUrl = spec.servers[0].url;

    assert.strictEqual(serverUrl, '/api/v1', 'Server URL must be /api/v1');

    const openApiMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
    for (const [openApiPath, pathItem] of Object.entries(spec.paths)) {
      // 1. Check resolveOperationUrl helper against raw string concatenation
      const resolvedUrl: string = resolveOperationUrl(serverUrl, openApiPath);
      const directConcat: string = `${serverUrl}${openApiPath}`;
      assert.strictEqual(resolvedUrl, directConcat, `Resolved URL mismatch for ${openApiPath}`);

      // 2. Guarantee no duplicate /api/v1 prefix (e.g. /api/v1/api/v1/health)
      assert.strictEqual(
        resolvedUrl.includes('/api/v1/api/v1'),
        false,
        `Resolved URL contains duplicate prefix: ${resolvedUrl}`
      );
      assert.ok(
        resolvedUrl.startsWith('/api/v1/'),
        `Resolved URL must start with /api/v1/: ${resolvedUrl}`
      );

      // 3. Reconcile each documented HTTP method with Express.
      const expressPattern = resolvedUrl.replace(/\{([^}]+)\}/g, ':$1');
      for (const method of Object.keys(pathItem)) {
        if (openApiMethods.has(method)) {
          assert.ok(expressRoutes.has(`${method.toUpperCase()} ${expressPattern}`), `OpenAPI ${method.toUpperCase()} ${expressPattern} is not registered in Express`);
        }
      }
    }

    for (const expressRoute of expressRoutes) {
      const [method, ...routeParts] = expressRoute.split(' ');
      if (method === 'OPTIONS') continue;
      const openApiPath = routeParts.join(' ').replace(/:([^/]+)/g, '{$1}').replace(/^\/api\/v1/, '');
      assert.ok(spec.paths[openApiPath]?.[method.toLowerCase()], `Express route ${expressRoute} is missing from OpenAPI`);
    }
  });

  it('[OAS-06]: directly probes resolved OpenAPI endpoints against live Express app', async () => {
    const spec = generateOpenApiSpec();
    const app = createApp();
    const serverUrl = spec.servers[0].url;

    // 1. Health check probe: resolved URL /api/v1/health returns 200 (never 404)
    const healthUrl = resolveOperationUrl(serverUrl, '/health');
    assert.strictEqual(healthUrl, '/api/v1/health');
    const healthRes = await request(app).get(healthUrl);
    assert.notStrictEqual(healthRes.status, 404, 'Health check should never return 404');
    assert.strictEqual(healthRes.status, 200);

    // 2. Order confirm probe: /api/v1/orders/{id}/confirm returns 401/403 (route matched, never 404)
    const confirmUrl = resolveOperationUrl(serverUrl, '/orders/00000000-0000-4000-8000-000000000001/confirm');
    assert.strictEqual(confirmUrl, '/api/v1/orders/00000000-0000-4000-8000-000000000001/confirm');
    const confirmRes = await request(app).post(confirmUrl);
    assert.notStrictEqual(confirmRes.status, 404, 'Order confirm route must be registered');

    // 3. Order transition probe: /api/v1/orders/{id}/transition returns 401/403 (route matched, never 404)
    const transitionUrl = resolveOperationUrl(serverUrl, '/orders/00000000-0000-4000-8000-000000000001/transition');
    assert.strictEqual(transitionUrl, '/api/v1/orders/00000000-0000-4000-8000-000000000001/transition');
    const transitionRes = await request(app).post(transitionUrl);
    assert.notStrictEqual(transitionRes.status, 404, 'Order transition route must be registered');

    // 4. Order payments probe: /api/v1/orders/{id}/payments returns 401/403 (route matched, never 404)
    const paymentsUrl = resolveOperationUrl(serverUrl, '/orders/00000000-0000-4000-8000-000000000001/payments');
    assert.strictEqual(paymentsUrl, '/api/v1/orders/00000000-0000-4000-8000-000000000001/payments');
    const paymentsRes = await request(app).post(paymentsUrl);
    assert.notStrictEqual(paymentsRes.status, 404, 'Order payments route must be registered');

    // 5. Addresses probe: /api/v1/addresses returns 401 (route matched, never 404)
    const addressesUrl = resolveOperationUrl(serverUrl, '/addresses');
    assert.strictEqual(addressesUrl, '/api/v1/addresses');
    const addressesRes = await request(app).get(addressesUrl);
    assert.notStrictEqual(addressesRes.status, 404, 'Addresses route must be registered');

    // 6. Vouchers probe: /api/v1/vouchers returns 401 (route matched, never 404)
    const vouchersUrl = resolveOperationUrl(serverUrl, '/vouchers');
    assert.strictEqual(vouchersUrl, '/api/v1/vouchers');
    const vouchersRes = await request(app).get(vouchersUrl);
    assert.notStrictEqual(vouchersRes.status, 404, 'Vouchers route must be registered');
  });
});
