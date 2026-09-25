import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { redactSensitiveData, sanitizeString } from '../../src/platform/logging/redact.ts';
import { createPlatformLogger } from '../../src/platform/logging/logger.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';

describe('Security Redaction & Secret Leak Prevention (Phase 3)', () => {
  it('[REDACT-01]: redacts sensitive keys in deeply nested objects and arrays', () => {
    const sensitivePayload = {
      user: {
        id: 'usr-123',
        password: 'SuperSecretPassword123!',
        profile: {
          email: 'test@example.com',
          creditCard: '4111222233334444',
          cvv: '123',
          pan: '5500000000000004'
        }
      },
      tokens: [
        { access_token: 'secret-token-value', expires_in: 3600 },
        { refresh_token: 'refresh-token-value' }
      ],
      authorization: 'Bearer token-here'
    };

    const redacted = redactSensitiveData(sensitivePayload);

    assert.strictEqual(redacted.user.id, 'usr-123');
    assert.strictEqual(redacted.user.password, '[REDACTED]');
    assert.strictEqual(redacted.user.profile.creditCard, '[REDACTED]');
    assert.strictEqual(redacted.user.profile.cvv, '[REDACTED]');
    assert.strictEqual(redacted.user.profile.pan, '[REDACTED]');
    assert.strictEqual(redacted.tokens[0].access_token, '[REDACTED]');
    assert.strictEqual(redacted.tokens[0].expires_in, 3600);
    assert.strictEqual(redacted.tokens[1].refresh_token, '[REDACTED]');
    assert.strictEqual(redacted.authorization, '[REDACTED]');
  });

  it('[REDACT-02]: redacts credit card PAN patterns inside arbitrary string values', () => {
    const rawString1 = 'Payment failed for card 4111-2222-3333-4444 during checkout';
    const rawString2 = 'Transaction on 4532 1234 5678 9010 declined';
    const rawString3 = 'Card number: 4000001234567890';

    assert.ok(!sanitizeString(rawString1).includes('4111-2222-3333-4444'));
    assert.ok(sanitizeString(rawString1).includes('[REDACTED_CARD]'));
    assert.ok(!sanitizeString(rawString2).includes('4532 1234 5678 9010'));
    assert.ok(sanitizeString(rawString2).includes('[REDACTED_CARD]'));
    assert.ok(!sanitizeString(rawString3).includes('4000001234567890'));
  });

  it('[REDACT-03]: redacts JWTs, Supabase service keys, and connection URI passwords in string values', () => {
    const jwtString = 'User token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in header';
    const supabaseKey = 'Error connecting with sbp_live_secret_key_abcdef1234567890abcdef to Supabase';
    const connectionUri = 'Failed to connect to postgresql://postgres:super_secret_pw@db.project.supabase.co:5432/postgres';

    const cleanJwt = sanitizeString(jwtString);
    assert.ok(!cleanJwt.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
    assert.ok(cleanJwt.includes('[REDACTED_JWT]'));

    const cleanSupabase = sanitizeString(supabaseKey);
    assert.ok(!cleanSupabase.includes('sbp_live_secret_key_abcdef1234567890abcdef'));
    assert.ok(cleanSupabase.includes('[REDACTED_SECRET]'));

    const cleanUri = sanitizeString(connectionUri);
    assert.ok(!cleanUri.includes('super_secret_pw'));
    assert.ok(cleanUri.includes('postgresql://postgres:[REDACTED]@db.project.supabase.co'));
  });

  it('[REDACT-04]: platform logger automatically applies string sanitization and object redaction', () => {
    let loggedOutput = '';
    const customLogger = createPlatformLogger('test-service', (line) => {
      loggedOutput = line;
    });

    customLogger.error('Database connection failed', {
      db_url: 'postgresql://postgres:mysecretpassword@localhost:5432/ecommerce',
      stack: 'Error: connect at postgresql://postgres:mysecretpassword@localhost:5432/ecommerce\n    at query (pg.js:10)',
      auth: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J_Users'
    });

    assert.ok(!loggedOutput.includes('mysecretpassword'));
    assert.ok(!loggedOutput.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
    assert.ok(loggedOutput.includes('[REDACTED]'));
  });

  it('[REDACT-05]: 500 error handler never leaks raw stack trace or database error details to client', async () => {
    const testApp = express();
    testApp.get('/crash', () => {
      throw new Error('relation "secret_table" does not exist at postgresql://postgres:secret_pass@localhost:5432/db');
    });
    testApp.use(errorHandlerMiddleware);

    const res = await request(testApp).get('/crash').expect(500);

    assert.strictEqual(res.body.error.code, 'INTERNAL_ERROR');
    assert.strictEqual(res.body.error.message, 'An internal error occurred');
    assert.strictEqual(res.body.error.details, undefined);
    // Ensure raw error message or connection strings are nowhere in response body
    const bodyStr = JSON.stringify(res.body);
    assert.ok(!bodyStr.includes('secret_table'));
    assert.ok(!bodyStr.includes('secret_pass'));
    assert.ok(!bodyStr.includes('postgresql://'));
  });
});
