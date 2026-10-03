import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { createAuthMiddleware, StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import { InMemoryAuthRepository } from '../../src/modules/identity/repositories/in-memory-auth.repository.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';
import { requestIdMiddleware } from '../../src/platform/http/middlewares/request-id.ts';
import { AuthConfigurationError } from '../../src/platform/errors/app-error.ts';

function createProtectedApp(authRepo: InMemoryAuthRepository, tokenVerifier = new StubTokenVerifier()) {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());

  const authMiddleware = createAuthMiddleware(authRepo, tokenVerifier);

  app.get('/api/v1/protected', authMiddleware, (req: Request, res: Response) => {
    res.status(200).json({
      data: {
        message: 'Access granted',
        context: req.context
      },
      request_id: req.requestId
    });
  });

  app.use(errorHandlerMiddleware);
  return app;
}

describe('Phase 4 — RequestContext & Auth Middleware Guard (QD03, RB-MG01, QD02)', () => {
  let authRepo: InMemoryAuthRepository;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    authRepo.seedUsers([
      { id: 'usr-buyer-1', email: 'buyer@test.com', role: 'BUYER', status: 'ACTIVE' },
      { id: 'usr-seller-1', email: 'seller@test.com', role: 'SELLER', status: 'ACTIVE' },
      { id: 'usr-admin-1', email: 'admin@test.com', role: 'ADMIN', status: 'ACTIVE' },
      { id: 'usr-locked-1', email: 'locked@test.com', role: 'BUYER', status: 'LOCKED' }
    ]);
    authRepo.seedShop('usr-seller-1', 'shop-uuid-100');
  });

  describe('createRequestContext Factory', () => {
    it('[AUTH-04] creates frozen immutable context for SELLER with shop_id', () => {
      const ctx = createRequestContext({
        request_id: 'req_123',
        user_id: 'usr-seller-1',
        role: 'SELLER',
        shop_id: 'shop-uuid-100'
      });

      assert.strictEqual(ctx.role, 'SELLER');
      assert.strictEqual(ctx.shop_id, 'shop-uuid-100');
      assert.ok(Object.isFrozen(ctx));
      // Immutability check
      assert.throws(() => {
        // @ts-expect-error - verifying runtime immutability
        ctx.role = 'BUYER';
      });
    });

    it('[AUTH-05] BUYER and ADMIN context strictly enforces shop_id to be undefined', () => {
      const buyerCtx = createRequestContext({
        request_id: 'req_123',
        user_id: 'usr-buyer-1',
        role: 'BUYER',
        shop_id: 'shop-uuid-should-be-ignored'
      });
      assert.strictEqual(buyerCtx.role, 'BUYER');
      assert.strictEqual(buyerCtx.shop_id, undefined);

      const adminCtx = createRequestContext({
        request_id: 'req_123',
        user_id: 'usr-admin-1',
        role: 'ADMIN',
        shop_id: 'shop-uuid-should-be-ignored'
      });
      assert.strictEqual(adminCtx.role, 'ADMIN');
      assert.strictEqual(adminCtx.shop_id, undefined);
    });

    it('[AUTH-06 / RB-MG01] invalid role throws VALIDATION_FAILED error', () => {
      assert.throws(
        () => {
          createRequestContext({
            request_id: 'req_123',
            user_id: 'usr-bad',
            // @ts-expect-error - testing invalid role
            role: 'SUPERUSER'
          });
        },
        (err: unknown) => {
          assert.strictEqual((err as { code: string }).code, 'VALIDATION_FAILED');
          return true;
        }
      );
    });
  });

  describe('Auth Middleware Security Checks', () => {
    it('[AUTH-01] returns 401 AUTH_REQUIRED when Authorization header is missing', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app).get('/api/v1/protected').expect(401);

      assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
      assert.ok(res.body.request_id);
    });

    it('[AUTH-01] returns 401 AUTH_REQUIRED when Authorization header is not Bearer', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Basic dXNlcjpwYXNz')
        .expect(401);

      assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
      assert.ok(res.body.request_id);
    });

    it('[AUTH-02] returns 401 AUTH_INVALID_TOKEN when token format is invalid or decode fails', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer invalid-token-format')
        .expect(401);

      assert.strictEqual(res.body.error.code, 'AUTH_INVALID_TOKEN');
      assert.ok(res.body.request_id);
    });

    it('[AUTH-03 / QD03] returns 403 USER_LOCKED when valid user has LOCKED status', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer stub-token-usr-locked-1')
        .expect(403);

      assert.strictEqual(res.body.error.code, 'USER_LOCKED');
      assert.strictEqual(res.body.error.message, 'User account is locked');
      assert.ok(res.body.request_id);
    });

    it('[AUTH-04] SELLER receives valid context with shop_id', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer stub-token-usr-seller-1')
        .expect(200);

      assert.strictEqual(res.body.data.context.user_id, 'usr-seller-1');
      assert.strictEqual(res.body.data.context.role, 'SELLER');
      assert.strictEqual(res.body.data.context.shop_id, 'shop-uuid-100');
    });

    it('[AUTH-05] BUYER receives valid context with shop_id as undefined', async () => {
      const app = createProtectedApp(authRepo);
      const res = await request(app)
        .get('/api/v1/protected')
        .set('Authorization', 'Bearer stub-token-usr-buyer-1')
        .expect(200);

      assert.strictEqual(res.body.data.context.user_id, 'usr-buyer-1');
      assert.strictEqual(res.body.data.context.role, 'BUYER');
      assert.strictEqual(res.body.data.context.shop_id, undefined);
    });

    it('[AUTH-07 / QD02] user record in IAuthRepository never contains plaintext password', async () => {
      const user = await authRepo.findUserById('usr-buyer-1');
      assert.ok(user);
      assert.strictEqual('password' in (user as object), false);
      assert.strictEqual('password_hash' in (user as object), false);
    });

    it('[AUTH-08 / FAIL-FAST] throws AUTH_CONFIGURATION_ERROR in production when using stub', () => {
      const prevEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        assert.throws(
          () => {
            createAuthMiddleware(authRepo, new StubTokenVerifier());
          },
          (err: unknown) => {
            assert.ok(err instanceof AuthConfigurationError);
            assert.strictEqual((err as AuthConfigurationError).code, 'AUTH_CONFIGURATION_ERROR');
            return true;
          }
        );
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });
});
