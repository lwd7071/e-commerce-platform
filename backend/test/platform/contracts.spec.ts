import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRequestContext,
  buildSuccessEnvelope,
  buildPaginatedEnvelope,
  buildErrorEnvelope,
  type RequestContext,
  type IAuditPort,
  type AdminAuditRecord
} from '../../src/contracts/index.ts';

describe('Phase 5 — Shared Contracts & Port Re-export Seam', () => {
  it('[CONTRACT-01] imports all shared helpers and types cleanly from @/contracts index without cyclic dependencies', () => {
    assert.strictEqual(typeof createRequestContext, 'function');
    assert.strictEqual(typeof buildSuccessEnvelope, 'function');
    assert.strictEqual(typeof buildPaginatedEnvelope, 'function');
    assert.strictEqual(typeof buildErrorEnvelope, 'function');

    const ctx: RequestContext = createRequestContext({
      request_id: 'req_contract_test',
      user_id: 'usr_contract_1',
      role: 'BUYER'
    });

    assert.strictEqual(ctx.role, 'BUYER');
    assert.strictEqual(ctx.shop_id, undefined);
    assert.ok(Object.isFrozen(ctx));
  });

  it('[CONTRACT-02] IAuditPort contract defines logAdminAction method', async () => {
    let auditCalled = false;
    const mockAuditPort: IAuditPort = {
      async logAdminAction(_trx: unknown, record: AdminAuditRecord): Promise<void> {
        assert.strictEqual(record.admin_id, 'adm-1');
        assert.strictEqual(record.action, 'LOCK_USER');
        assert.strictEqual(record.target_type, 'User');
        assert.strictEqual(record.target_id, 'usr-2');
        assert.strictEqual(record.reason, 'Violation of terms');
        auditCalled = true;
      }
    };

    await mockAuditPort.logAdminAction(null, {
      admin_id: 'adm-1',
      action: 'LOCK_USER',
      target_type: 'User',
      target_id: 'usr-2',
      reason: 'Violation of terms'
    });

    assert.strictEqual(auditCalled, true);
  });
});
