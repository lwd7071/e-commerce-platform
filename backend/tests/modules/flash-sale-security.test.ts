import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import { validatePurchaseBody } from '../../src/modules/flash-sale/dtos/purchase.dto.ts';
import { adminOrInternalKeyGuard } from '../../src/modules/flash-sale/routes/flash-sale.routes.ts';
import { InvalidRequestError, ForbiddenError, UnauthorizedError } from '../../src/platform/errors/app-error.ts';
import type { Request, Response } from 'express';

describe('Flash Sale Security & Validation Guard', () => {
  describe('validatePurchaseBody', () => {
    it('accepts valid purchase payload and strips harmless unknown fields', () => {
      const input = {
        idempotency_key: 'idemp-key-test-1234567890',
        voucher_code: 'VOUCHER10',
        recipient_name: 'Nguyễn Văn A',
        recipient_phone: '0901234567',
        province: 'Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Bến Nghé',
        delivery_address: '123 Lê Duẩn',
        _tracking_id: 'analytics_click_123', // Harmless extra field
        client_timestamp: Date.now(), // Harmless extra field
      };

      const result = validatePurchaseBody(input);
      assert.equal(result.idempotency_key, 'idemp-key-test-1234567890');
      assert.equal(result.recipient_name, 'Nguyễn Văn A');
      assert.equal((result as any)._tracking_id, undefined, 'Extra unknown fields must be automatically stripped');
      assert.equal((result as any).client_timestamp, undefined, 'Extra unknown fields must be automatically stripped');
    });

    it('rejects identity spoofing attempt with user_id', () => {
      const input = {
        user_id: 'spoofed-user-uuid',
        recipient_name: 'Attacker',
      };

      assert.throws(
        () => validatePurchaseBody(input),
        (err: unknown) => {
          assert(err instanceof InvalidRequestError);
          assert.equal(err.httpStatus, 400);
          return true;
        }
      );
    });

    it('rejects identity spoofing attempts with normalized variations: userId, USER_ID, user-id', () => {
      const variations = [
        { userId: 'spoofed-1' },
        { USER_ID: 'spoofed-2' },
        { 'user-id': 'spoofed-3' },
        { UserId: 'spoofed-4' },
      ];

      for (const input of variations) {
        assert.throws(
          () => validatePurchaseBody(input),
          (err: unknown) => {
            assert(err instanceof InvalidRequestError);
            assert.equal(err.httpStatus, 400);
            return true;
          },
          `Failed to reject variation: ${JSON.stringify(input)}`
        );
      }
    });
  });

  describe('adminOrInternalKeyGuard', () => {
    const originalEnvKey = process.env.INTERNAL_SERVICE_KEY;
    const dummyRes = {} as Response;

    it('allows caller with valid internal service key', () => {
      process.env.INTERNAL_SERVICE_KEY = 'secret-test-key-32chars-long-1234';
      let nextCalled = false;
      const req = {
        header: (name: string) => (name.toLowerCase() === 'x-internal-key' ? 'secret-test-key-32chars-long-1234' : undefined),
      } as unknown as Request;

      adminOrInternalKeyGuard(req, dummyRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      process.env.INTERNAL_SERVICE_KEY = originalEnvKey;
    });

    it('allows caller with ADMIN role', () => {
      let nextCalled = false;
      const req = {
        header: () => undefined,
        context: { role: 'ADMIN', user_id: 'admin-uuid' },
      } as unknown as Request;

      adminOrInternalKeyGuard(req, dummyRes, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
    });

    it('rejects unauthenticated caller without internal key with 401 UnauthorizedError', () => {
      const req = {
        header: () => undefined,
      } as unknown as Request;

      assert.throws(
        () => adminOrInternalKeyGuard(req, dummyRes, () => {}),
        (err: unknown) => {
          assert(err instanceof UnauthorizedError);
          assert.equal(err.httpStatus, 401);
          return true;
        }
      );
    });

    it('rejects BUYER or SELLER role without internal key with 403 ForbiddenError', () => {
      const reqBuyer = {
        header: () => undefined,
        context: { role: 'BUYER', user_id: 'buyer-uuid' },
      } as unknown as Request;

      assert.throws(
        () => adminOrInternalKeyGuard(reqBuyer, dummyRes, () => {}),
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.equal(err.httpStatus, 403);
          return true;
        }
      );

      const reqSeller = {
        header: () => undefined,
        context: { role: 'SELLER', user_id: 'seller-uuid' },
      } as unknown as Request;

      assert.throws(
        () => adminOrInternalKeyGuard(reqSeller, dummyRes, () => {}),
        (err: unknown) => {
          assert(err instanceof ForbiddenError);
          assert.equal(err.httpStatus, 403);
          return true;
        }
      );
    });
  });
});
