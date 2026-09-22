import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';
import { requestIdMiddleware } from '../../src/platform/http/middlewares/request-id.ts';
import {
  requireRole,
  requireBuyerOwnership,
  requireShopOwnership
} from '../../src/platform/http/middlewares/rbac.ts';
import type { UserRole } from '../../src/modules/identity/domain/types.ts';

function createTestApp(options?: {
  role?: UserRole;
  userId?: string;
  shopId?: string;
  noContext?: boolean;
}) {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());

  // Inject RequestContext if not explicitly disabled
  app.use((req: Request, _res: Response, next) => {
    if (!options?.noContext) {
      req.context = createRequestContext({
        request_id: req.requestId || 'req_test',
        user_id: options?.userId || 'usr-default-1',
        role: options?.role || 'BUYER',
        shop_id: options?.shopId
      });
    }
    next();
  });

  // Role protected routes
  app.get('/admin-only', requireRole('ADMIN'), (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', role: 'ADMIN' });
  });

  app.get('/seller-or-admin', requireRole('SELLER', 'ADMIN'), (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', access: 'SELLER_OR_ADMIN' });
  });

  // Buyer ownership route: /buyers/:user_id/profile
  app.get(
    '/buyers/:user_id/profile',
    requireBuyerOwnership((req) => req.params.user_id),
    (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', resource: 'buyer-profile' });
    }
  );

  // Seller shop ownership route: /shops/:shop_id/settings
  app.get(
    '/shops/:shop_id/settings',
    requireShopOwnership((req) => req.params.shop_id),
    (_req: Request, res: Response) => {
      res.status(200).json({ status: 'ok', resource: 'shop-settings' });
    }
  );

  app.use(errorHandlerMiddleware);
  return app;
}

describe('Phase 1 — RBAC & Ownership Guard Middleware (auth-rbac-rls.md, error-observability.md)', () => {
  describe('TDD Cycle 1.1: requireRole', () => {
    it('Case 1: rejects unauthenticated request (no context) with 401 AUTH_REQUIRED', async () => {
      const app = createTestApp({ noContext: true });
      const res = await request(app).get('/admin-only');

      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
    });

    it('Case 2: rejects wrong role (BUYER accessing ADMIN route) with 403 RESOURCE_FORBIDDEN', async () => {
      const app = createTestApp({ role: 'BUYER' });
      const res = await request(app).get('/admin-only');

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
    });

    it('Case 3: allows matching role (ADMIN accessing ADMIN route) with 200 OK', async () => {
      const app = createTestApp({ role: 'ADMIN' });
      const res = await request(app).get('/admin-only');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    it('Case 4: allows any of multiple allowed roles (SELLER accessing SELLER_OR_ADMIN) with 200 OK', async () => {
      const app = createTestApp({ role: 'SELLER', shopId: 'shop-1' });
      const res = await request(app).get('/seller-or-admin');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.access, 'SELLER_OR_ADMIN');
    });
  });

  describe('TDD Cycle 1.2: requireOwnership', () => {
    it('Case 1 (Buyer Ownership): rejects access to another buyer resource with 404 RESOURCE_NOT_FOUND (anti-enumeration)', async () => {
      const app = createTestApp({ role: 'BUYER', userId: 'usr-buyer-1' });
      const res = await request(app).get('/buyers/usr-buyer-2/profile');

      assert.strictEqual(res.status, 404);
      assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
    });

    it('Case 2 (Buyer Ownership Success): allows buyer accessing own resource with 200 OK', async () => {
      const app = createTestApp({ role: 'BUYER', userId: 'usr-buyer-1' });
      const res = await request(app).get('/buyers/usr-buyer-1/profile');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    it('Case 3 (Seller Ownership): rejects seller accessing another shop with 403 RESOURCE_FORBIDDEN', async () => {
      const app = createTestApp({ role: 'SELLER', userId: 'usr-seller-1', shopId: 'shop-1' });
      const res = await request(app).get('/shops/shop-2/settings');

      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
    });

    it('Case 4 (Seller Ownership Success): allows seller accessing own shop with 200 OK', async () => {
      const app = createTestApp({ role: 'SELLER', userId: 'usr-seller-1', shopId: 'shop-1' });
      const res = await request(app).get('/shops/shop-1/settings');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    it('Case 5 (Admin Bypass): allows admin accessing any buyer resource with 200 OK', async () => {
      const app = createTestApp({ role: 'ADMIN', userId: 'usr-admin-1' });
      const res = await request(app).get('/buyers/usr-buyer-2/profile');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });

    it('Case 6 (Admin Bypass): allows admin accessing any shop resource with 200 OK', async () => {
      const app = createTestApp({ role: 'ADMIN', userId: 'usr-admin-1' });
      const res = await request(app).get('/shops/shop-2/settings');

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
    });
  });
});
