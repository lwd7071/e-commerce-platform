import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PgAuditRepository } from '../../src/platform/audit/pg-audit.repository.ts';
import { ValidationFailedError } from '../../src/platform/errors/app-error.ts';

interface QueryCall {
  sql: string;
  params: unknown[];
}

function createFakeClient(shouldThrowOnQuery = false) {
  const calls: QueryCall[] = [];
  return {
    calls,
    query: async (sql: string, params: unknown[] = []) => {
      if (shouldThrowOnQuery) {
        throw new Error('Simulated database write error');
      }
      calls.push({ sql, params });
      return { rowCount: 1, rows: [] };
    }
  };
}

describe('Phase 3 — TDD Cycle 3.1: PostgreSQL Audit Adapter (PgAuditRepository)', () => {
  const auditRepo = new PgAuditRepository();

  it('Case 1: successfully writes AdminAuditRecord to admin_logs in transaction context', async () => {
    const fakeClient = createFakeClient();
    const record = {
      admin_id: '00000000-0000-0000-0000-000000000001',
      action: 'LOCK_USER',
      target_type: 'USER',
      target_id: '00000000-0000-0000-0000-000000000002',
      reason: 'Violated terms of service'
    };

    await auditRepo.logAdminAction(fakeClient, record);

    assert.strictEqual(fakeClient.calls.length, 1);
    const call = fakeClient.calls[0];
    assert.ok(call.sql.includes('INSERT INTO admin_logs'));
    assert.strictEqual(call.params[1], record.admin_id);
    assert.strictEqual(call.params[2], record.action);
    assert.strictEqual(call.params[3], record.target_type);
    assert.strictEqual(call.params[4], record.target_id);
    assert.strictEqual(call.params[5], record.reason);
  });

  it('Case 2: rejects when admin_id or action is missing with ValidationFailedError', async () => {
    const fakeClient = createFakeClient();

    await assert.rejects(
      async () => {
        await auditRepo.logAdminAction(fakeClient, {
          admin_id: '',
          action: 'LOCK_USER'
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.strictEqual((err as ValidationFailedError).code, 'VALIDATION_FAILED');
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await auditRepo.logAdminAction(fakeClient, {
          admin_id: '00000000-0000-0000-0000-000000000001',
          action: ''
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        return true;
      }
    );
  });

  it('Case 3 (RB-KN20 Validation): rejects target_type not in allowed enum with ValidationFailedError (422)', async () => {
    const fakeClient = createFakeClient();

    await assert.rejects(
      async () => {
        await auditRepo.logAdminAction(fakeClient, {
          admin_id: '00000000-0000-0000-0000-000000000001',
          action: 'LOCK_USER',
          target_type: 'ORDER', // Invalid polymorphic target
          target_id: '00000000-0000-0000-0000-000000000002'
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.strictEqual((err as ValidationFailedError).httpStatus, 422);
        assert.strictEqual((err as ValidationFailedError).code, 'VALIDATION_FAILED');
        return true;
      }
    );
  });

  it('Case 4 (RB-KN20 Structure): rejects when target_type is provided without target_id or vice versa', async () => {
    const fakeClient = createFakeClient();

    await assert.rejects(
      async () => {
        await auditRepo.logAdminAction(fakeClient, {
          admin_id: '00000000-0000-0000-0000-000000000001',
          action: 'LOCK_USER',
          target_type: 'USER'
          // missing target_id
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await auditRepo.logAdminAction(fakeClient, {
          admin_id: '00000000-0000-0000-0000-000000000001',
          action: 'LOCK_USER',
          target_id: '00000000-0000-0000-0000-000000000002'
          // missing target_type
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        return true;
      }
    );
  });
});
