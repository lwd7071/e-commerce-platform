import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express, { type Request, type Response } from 'express';
import {
  ValidationFailedError,
  InvalidRequestError,
  ReasonRequiredError,
  AuditWriteFailedError,
  DependencyUnavailableError,
  InvalidStateTransitionError
} from '../../src/platform/errors/app-error.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';
import { requestIdMiddleware } from '../../src/platform/http/middlewares/request-id.ts';
import { redactSensitiveData } from '../../src/platform/logging/redact.ts';
import { createPlatformLogger } from '../../src/platform/logging/logger.ts';

function createTestErrorApp() {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());

  app.get('/test-error/bad-syntax', () => {
    throw new InvalidRequestError('Bad syntax');
  });

  app.post('/test-error/json-body', (req: Request, res: Response) => {
    res.status(200).json({ received: req.body });
  });

  app.get('/test-error/validation', () => {
    throw new ValidationFailedError('Invalid field', [{ field: 'email', message: 'Email required' }]);
  });

  app.get('/test-error/crash', () => {
    throw new Error('Database crash host: postgres://postgres:secretpassword@localhost:5432/db');
  });

  // Endpoints for Postgres Error Translation (Cycle 2.2)
  app.get('/test-error/pg-unique-email', () => {
    const err = new Error('duplicate key value violates unique constraint "uq_app_users__email"');
    (err as unknown as Record<string, unknown>).code = '23505';
    (err as unknown as Record<string, unknown>).constraint = 'uq_app_users__email';
    (err as unknown as Record<string, unknown>).detail = 'Key (email)=(duplicate@test.com) already exists.';
    throw err;
  });

  app.get('/test-error/pg-unique-shop', () => {
    const err = new Error('duplicate key value violates unique constraint "uq_shops__owner_id"');
    (err as unknown as Record<string, unknown>).code = '23505';
    (err as unknown as Record<string, unknown>).constraint = 'uq_shops__owner_id';
    throw err;
  });

  app.get('/test-error/pg-fk-insert', () => {
    const err = new Error('insert or update on table "admin_logs" violates foreign key constraint');
    (err as unknown as Record<string, unknown>).code = '23503';
    (err as unknown as Record<string, unknown>).detail = 'Key (admin_id)=(00000000-0000-0000-0000-000000000099) is not present in table "app_users".';
    throw err;
  });

  app.get('/test-error/pg-fk-delete', () => {
    const err = new Error('update or delete on table "app_users" violates foreign key constraint "fk_orders__buyer_id"');
    (err as unknown as Record<string, unknown>).code = '23503';
    (err as unknown as Record<string, unknown>).detail = 'Key (user_id)=(...) is still referenced from table "orders".';
    throw err;
  });

  app.get('/test-error/pg-check', () => {
    const err = new Error('new row for relation "product_variants" violates check constraint "ck_product_variants__price_positive"');
    (err as unknown as Record<string, unknown>).code = '23514';
    (err as unknown as Record<string, unknown>).constraint = 'ck_product_variants__price_positive';
    throw err;
  });

  app.use(errorHandlerMiddleware);
  return app;
}

describe('Phase 3 — Error Handling & Security Log Redaction', () => {
  describe('Error Middleware', () => {
    const app = createTestErrorApp();

    it('[ERR-01] handles AppError and returns matching HTTP status and code', async () => {
      const res = await request(app)
        .get('/test-error/bad-syntax')
        .expect(400);

      assert.strictEqual(res.body.error.code, 'INVALID_REQUEST');
      assert.strictEqual(res.body.error.message, 'Bad syntax');
      assert.ok(res.body.request_id);
    });

    it('[ERR-02] catches malformed JSON body from express.json and returns 400 INVALID_REQUEST', async () => {
      const res = await request(app)
        .post('/test-error/json-body')
        .set('Content-Type', 'application/json')
        .send('{"name": "invalid-json", bad_syntax}')
        .expect(400);

      assert.strictEqual(res.body.error.code, 'INVALID_REQUEST');
      assert.ok(res.body.request_id);
    });

    it('[ERR-03] returns 422 VALIDATION_FAILED with structured details', async () => {
      const res = await request(app)
        .get('/test-error/validation')
        .expect(422);

      assert.strictEqual(res.body.error.code, 'VALIDATION_FAILED');
      assert.strictEqual(res.body.error.message, 'Invalid field');
      assert.deepStrictEqual(res.body.error.details, [{ field: 'email', message: 'Email required' }]);
      assert.ok(res.body.request_id);
    });

    it('[ERR-04] catches unhandled Error and returns 500 INTERNAL_ERROR hiding stack trace and DB secrets', async () => {
      const res = await request(app)
        .get('/test-error/crash')
        .expect(500);

      assert.strictEqual(res.body.error.code, 'INTERNAL_ERROR');
      assert.strictEqual(res.body.error.message, 'An internal error occurred');
      assert.strictEqual(res.body.error.details, undefined);
      // Ensure no database credentials or stack traces are leaked to client
      const bodyStr = JSON.stringify(res.body);
      assert.ok(!bodyStr.includes('postgres://'));
      assert.ok(!bodyStr.includes('secretpassword'));
      assert.ok(!bodyStr.includes('Error: Database crash'));
      assert.ok(res.body.request_id);
    });
  });

  describe('Security Redaction & Structured Logger', () => {
    it('[LOG-01] redactSensitiveData redacts password, otp, token, secret, api_key, card', () => {
      const input = {
        user: {
          username: 'alice',
          password: 'my-super-secret-password',
          otp: '123456',
          access_token: 'jwt.token.abc',
          refresh_token: 'refresh.token.xyz',
          apiKey: 'pk_live_12345',
          service_role_key: 'secret_service_key'
        },
        payment: {
          credit_card: '4111222233334444',
          pan: '4111222233334444',
          cvv: '999',
          authorization: 'Bearer token-raw'
        },
        publicField: 'safe data'
      };

      const redacted = redactSensitiveData(input);

      assert.strictEqual(redacted.user.username, 'alice');
      assert.strictEqual(redacted.user.password, '[REDACTED]');
      assert.strictEqual(redacted.user.otp, '[REDACTED]');
      assert.strictEqual(redacted.user.access_token, '[REDACTED]');
      assert.strictEqual(redacted.user.refresh_token, '[REDACTED]');
      assert.strictEqual(redacted.user.apiKey, '[REDACTED]');
      assert.strictEqual(redacted.user.service_role_key, '[REDACTED]');
      assert.strictEqual(redacted.payment.credit_card, '[REDACTED]');
      assert.strictEqual(redacted.payment.pan, '[REDACTED]');
      assert.strictEqual(redacted.payment.cvv, '[REDACTED]');
      assert.strictEqual(redacted.payment.authorization, '[REDACTED]');
      assert.strictEqual(redacted.publicField, 'safe data');
    });

    it('[LOG-02] createPlatformLogger outputs valid JSON log conforming to error-observability.md', () => {
      let loggedMessage = '';
      const customOutput = (msg: string) => {
        loggedMessage = msg;
      };

      const logger = createPlatformLogger('payload-api', customOutput);
      logger.info('Test log event', {
        request_id: 'req_12345',
        method: 'POST',
        route: '/api/v1/orders',
        status: 201,
        duration_ms: 45,
        token: 'leak-token'
      });

      assert.ok(loggedMessage.length > 0);
      const parsed = JSON.parse(loggedMessage);
      assert.strictEqual(parsed.service, 'payload-api');
      assert.strictEqual(parsed.level, 'info');
      assert.strictEqual(parsed.request_id, 'req_12345');
      assert.strictEqual(parsed.route, '/api/v1/orders');
      assert.strictEqual(parsed.status, 201);
      assert.strictEqual(parsed.duration_ms, 45);
      // Redaction in logger
      assert.strictEqual(parsed.token, '[REDACTED]');
    });
  });

  describe('TDD Cycle 2.1: AppError Subclasses', () => {
    it('Case 1: ReasonRequiredError has status 422 and code REASON_REQUIRED', () => {
      const err = new ReasonRequiredError('Reason is mandatory for moderation');
      assert.strictEqual(err.httpStatus, 422);
      assert.strictEqual(err.code, 'REASON_REQUIRED');
      assert.strictEqual(err.message, 'Reason is mandatory for moderation');
    });

    it('Case 2: AuditWriteFailedError has status 500 and code AUDIT_WRITE_FAILED', () => {
      const err = new AuditWriteFailedError('Failed to commit admin audit log');
      assert.strictEqual(err.httpStatus, 500);
      assert.strictEqual(err.code, 'AUDIT_WRITE_FAILED');
      assert.strictEqual(err.message, 'Failed to commit admin audit log');
    });

    it('Case 3: DependencyUnavailableError has status 503 and code DEPENDENCY_UNAVAILABLE', () => {
      const err = new DependencyUnavailableError('Database service unreachable');
      assert.strictEqual(err.httpStatus, 503);
      assert.strictEqual(err.code, 'DEPENDENCY_UNAVAILABLE');
      assert.strictEqual(err.message, 'Database service unreachable');
    });

    it('Case 4: InvalidStateTransitionError has status 409 and accepts specific contextual code', () => {
      const lockErr = new InvalidStateTransitionError('USER_ALREADY_LOCKED', 'User is already locked');
      assert.strictEqual(lockErr.httpStatus, 409);
      assert.strictEqual(lockErr.code, 'USER_ALREADY_LOCKED');
      assert.strictEqual(lockErr.message, 'User is already locked');

      const activeErr = new InvalidStateTransitionError('USER_ALREADY_ACTIVE', 'User is already active');
      assert.strictEqual(activeErr.httpStatus, 409);
      assert.strictEqual(activeErr.code, 'USER_ALREADY_ACTIVE');
      assert.strictEqual(activeErr.message, 'User is already active');
    });
  });

  describe('TDD Cycle 2.2: Postgres Error Translation Middleware', () => {
    const app = createTestErrorApp();

    it('Case 1: maps unique violation (23505) to 409 with specific conflict code', async () => {
      const res = await request(app).get('/test-error/pg-unique-email').expect(409);
      assert.strictEqual(res.body.error.code, 'USER_EMAIL_CONFLICT');
      assert.ok(res.body.error.message.includes('Email already exists') || res.body.error.message.includes('already exists'));
      assert.ok(!JSON.stringify(res.body).includes('uq_app_users__email'));

      const resShop = await request(app).get('/test-error/pg-unique-shop').expect(409);
      assert.strictEqual(resShop.body.error.code, 'SHOP_ALREADY_EXISTS');
    });

    it('Case 2a: maps foreign key violation (23503) on insert/update to 404 RESOURCE_NOT_FOUND', async () => {
      const res = await request(app).get('/test-error/pg-fk-insert').expect(404);
      assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
      assert.ok(!JSON.stringify(res.body).includes('violates foreign key'));
    });

    it('Case 2b: maps foreign key violation (23503) on delete restrict to 409 RESOURCE_DELETE_NOT_ALLOWED', async () => {
      const res = await request(app).get('/test-error/pg-fk-delete').expect(409);
      assert.strictEqual(res.body.error.code, 'RESOURCE_DELETE_NOT_ALLOWED');
      assert.ok(!JSON.stringify(res.body).includes('violates foreign key'));
    });

    it('Case 3: maps check constraint violation (23514) to 422 VALIDATION_FAILED', async () => {
      const res = await request(app).get('/test-error/pg-check').expect(422);
      assert.strictEqual(res.body.error.code, 'VALIDATION_FAILED');
      assert.ok(!JSON.stringify(res.body).includes('ck_product_variants__price_positive'));
    });
  });
});
