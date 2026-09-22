import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ModerationService } from '../../../src/modules/moderation/services/moderation.service.ts';
import type { ITargetLookupRepository, ModerationRecord } from '../../../src/modules/moderation/domain/moderation.types.ts';
import type { IAuditPort, AdminAuditRecord } from '../../../src/contracts/audit.port.ts';
import type { UserStatus } from '../../../src/modules/identity/domain/types.ts';
import {
  ValidationFailedError,
  ReasonRequiredError,
  NotFoundError,
  InvalidStateTransitionError,
  AuditWriteFailedError
} from '../../../src/platform/errors/app-error.ts';

class InMemoryTargetRepository implements ITargetLookupRepository {
  public users: Map<string, { id: string; status: UserStatus; updated_at: string }> = new Map();
  public shops: Set<string> = new Set();
  public products: Set<string> = new Set();
  public reviews: Set<string> = new Set();
  public moderationRecords: ModerationRecord[] = [];

  private snapshot: Map<string, { id: string; status: UserStatus; updated_at: string }> | null = null;
  private modSnapshot: ModerationRecord[] | null = null;

  savepoint() {
    this.snapshot = new Map(Array.from(this.users.entries()).map(([k, v]) => [k, { ...v }]));
    this.modSnapshot = [...this.moderationRecords];
  }

  rollback() {
    if (this.snapshot) {
      this.users = this.snapshot;
      this.snapshot = null;
    }
    if (this.modSnapshot) {
      this.moderationRecords = this.modSnapshot;
      this.modSnapshot = null;
    }
  }

  commit() {
    this.snapshot = null;
    this.modSnapshot = null;
  }

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const u = this.users.get(userId);
    return u ? u.status : null;
  }

  async updateUserStatus(_trx: unknown, userId: string, status: UserStatus): Promise<{ user_id: string; status: UserStatus; updated_at: string }> {
    const u = this.users.get(userId);
    if (!u) throw new NotFoundError('User not found');
    u.status = status;
    u.updated_at = new Date().toISOString();
    return { user_id: u.id, status: u.status, updated_at: u.updated_at };
  }

  async shopExists(shopId: string): Promise<boolean> {
    return this.shops.has(shopId);
  }

  async productExists(productId: string): Promise<boolean> {
    return this.products.has(productId);
  }

  async reviewExists(reviewId: string): Promise<boolean> {
    return this.reviews.has(reviewId);
  }

  async insertModerationRecord(_trx: unknown, record: ModerationRecord): Promise<void> {
    this.moderationRecords.push(record);
  }
}

class FakeAuditPort implements IAuditPort {
  public auditRecords: AdminAuditRecord[] = [];
  public shouldFail = false;

  async logAdminAction(_trx: unknown, record: AdminAuditRecord): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Simulated audit logging failure');
    }
    this.auditRecords.push(record);
  }
}

class SpyTransactionManager {
  public log: string[] = [];
  public rolledBack = false;
  public committed = false;

  constructor(private readonly targetRepo?: InMemoryTargetRepository) {}

  async withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T> {
    this.log.push('BEGIN');
    this.targetRepo?.savepoint();
    const fakeClient = { id: 'fake-tx-client' };
    try {
      const result = await fn(fakeClient);
      this.log.push('COMMIT');
      this.committed = true;
      this.targetRepo?.commit();
      return result;
    } catch (err) {
      this.log.push('ROLLBACK');
      this.rolledBack = true;
      this.targetRepo?.rollback();
      throw err;
    }
  }
}

describe('Phase 3 — TDD Cycle 3.2: ModerationService with Atomic Transaction (QD17, QD20, RB-KN20)', () => {
  let targetRepo: InMemoryTargetRepository;
  let auditPort: FakeAuditPort;
  let txManager: SpyTransactionManager;
  let service: ModerationService;

  const validAdminId = '00000000-0000-0000-0000-000000000001';
  const activeUserId = '00000000-0000-0000-0000-000000000002';
  const lockedUserId = '00000000-0000-0000-0000-000000000003';

  beforeEach(() => {
    targetRepo = new InMemoryTargetRepository();
    targetRepo.users.set(activeUserId, { id: activeUserId, status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    targetRepo.users.set(lockedUserId, { id: lockedUserId, status: 'LOCKED', updated_at: '2026-01-01T00:00:00.000Z' });
    targetRepo.shops.add('00000000-0000-0000-0000-000000000010');
    targetRepo.products.add('00000000-0000-0000-0000-000000000020');
    targetRepo.reviews.add('00000000-0000-0000-0000-000000000030');

    auditPort = new FakeAuditPort();
    txManager = new SpyTransactionManager(targetRepo);
    service = new ModerationService(targetRepo, auditPort, txManager);
  });

  it('Case 1 (Bước 1 - Invalid Target Type): rejects unsupported target_type with 422 VALIDATION_FAILED', async () => {
    await assert.rejects(
      async () => {
        await service.moderateTarget({
          admin_id: validAdminId,
          target_type: 'ORDER' as unknown as 'USER',
          target_id: '00000000-0000-0000-0000-000000000099',
          action: 'LOCK',
          reason: 'Test reason'
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

  it('Case 2 (Bước 2 - Invalid Target ID Structure): rejects missing or non-UUID target_id with 422 VALIDATION_FAILED', async () => {
    await assert.rejects(
      async () => {
        await service.moderateTarget({
          admin_id: validAdminId,
          target_type: 'USER',
          target_id: 'invalid-not-a-uuid',
          action: 'LOCK',
          reason: 'Test reason'
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ValidationFailedError);
        assert.strictEqual((err as ValidationFailedError).httpStatus, 422);
        return true;
      }
    );
  });

  it('Case 3 (Bước 3 - QD17 Missing Reason): rejects empty or whitespace reason with 422 REASON_REQUIRED', async () => {
    await assert.rejects(
      async () => {
        await service.moderateTarget({
          admin_id: validAdminId,
          target_type: 'USER',
          target_id: activeUserId,
          action: 'LOCK',
          reason: '   '
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof ReasonRequiredError);
        assert.strictEqual((err as ReasonRequiredError).httpStatus, 422);
        assert.strictEqual((err as ReasonRequiredError).code, 'REASON_REQUIRED');
        return true;
      }
    );
  });

  it('Case 4 (Bước 4 - RB-KN20 Target Non-existent): rejects non-existent target with 404 RESOURCE_NOT_FOUND', async () => {
    const nonExistentId = '00000000-0000-0000-0000-000000000999';

    await assert.rejects(
      async () => {
        await service.moderateTarget({
          admin_id: validAdminId,
          target_type: 'USER',
          target_id: nonExistentId,
          action: 'LOCK',
          reason: 'Valid reason'
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.strictEqual((err as NotFoundError).httpStatus, 404);
        assert.strictEqual((err as NotFoundError).code, 'RESOURCE_NOT_FOUND');
        return true;
      }
    );
  });

  it('Case 5 (Bước 5 - Idempotency Lock): rejects locking an already LOCKED user with 409 USER_ALREADY_LOCKED', async () => {
    await assert.rejects(
      async () => {
        await service.lockUser(validAdminId, lockedUserId, 'Repeated lock');
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidStateTransitionError);
        assert.strictEqual((err as InvalidStateTransitionError).httpStatus, 409);
        assert.strictEqual((err as InvalidStateTransitionError).code, 'USER_ALREADY_LOCKED');
        return true;
      }
    );
    // Verified: No transaction executed, no duplicate log created
    assert.strictEqual(txManager.log.length, 0);
    assert.strictEqual(auditPort.auditRecords.length, 0);
  });

  it('Case 6 (Bước 5 - Idempotency Unlock): rejects unlocking an already ACTIVE user with 409 USER_ALREADY_ACTIVE', async () => {
    await assert.rejects(
      async () => {
        await service.unlockUser(validAdminId, activeUserId, 'Repeated unlock');
      },
      (err: unknown) => {
        assert.ok(err instanceof InvalidStateTransitionError);
        assert.strictEqual((err as InvalidStateTransitionError).httpStatus, 409);
        assert.strictEqual((err as InvalidStateTransitionError).code, 'USER_ALREADY_ACTIVE');
        return true;
      }
    );
    assert.strictEqual(txManager.log.length, 0);
  });

  it('Case 7 (Bước 6 - QD20 Atomic Rollback): rolls back transaction and throws 500 AUDIT_WRITE_FAILED when audit log fails', async () => {
    auditPort.shouldFail = true;

    // Deep copy original state to verify rollback
    const originalStatus = (await targetRepo.getUserStatus(activeUserId))!;

    await assert.rejects(
      async () => {
        await service.lockUser(validAdminId, activeUserId, 'Valid violation reason');
      },
      (err: unknown) => {
        assert.ok(err instanceof AuditWriteFailedError);
        assert.strictEqual((err as AuditWriteFailedError).httpStatus, 500);
        assert.strictEqual((err as AuditWriteFailedError).code, 'AUDIT_WRITE_FAILED');
        return true;
      }
    );

    // Verified: Transaction was rolled back
    assert.ok(txManager.rolledBack);
    assert.strictEqual(txManager.log.includes('ROLLBACK'), true);
    // User status must remain ACTIVE
    const currentStatus = await targetRepo.getUserStatus(activeUserId);
    assert.strictEqual(currentStatus, originalStatus);
  });

  it('Case 8 (Bước 6 - QD20 Happy Path Lock): successfully commits lock, updates status, writes moderation record and audit log', async () => {
    const result = await service.lockUser(validAdminId, activeUserId, 'Spamming on platform');

    assert.strictEqual(result.user_id, activeUserId);
    assert.strictEqual(result.status, 'LOCKED');
    assert.ok(result.updated_at);

    // Verified: Transaction was committed
    assert.ok(txManager.committed);
    assert.strictEqual(txManager.log.includes('COMMIT'), true);

    // Verified: moderation record inserted
    assert.strictEqual(targetRepo.moderationRecords.length, 1);
    const modRecord = targetRepo.moderationRecords[0];
    assert.strictEqual(modRecord.target_type, 'USER');
    assert.strictEqual(modRecord.target_id, activeUserId);
    assert.strictEqual(modRecord.action, 'LOCK');
    assert.strictEqual(modRecord.reason, 'Spamming on platform');
    assert.strictEqual(modRecord.admin_id, validAdminId);

    // Verified: audit log inserted
    assert.strictEqual(auditPort.auditRecords.length, 1);
    const audit = auditPort.auditRecords[0];
    assert.strictEqual(audit.admin_id, validAdminId);
    assert.strictEqual(audit.action, 'LOCK_USER');
    assert.strictEqual(audit.target_id, activeUserId);
  });

  it('Case 9 (Bước 6 - QD20 Happy Path Unlock): successfully commits unlock on locked user', async () => {
    const result = await service.unlockUser(validAdminId, lockedUserId, 'Appeal accepted');

    assert.strictEqual(result.user_id, lockedUserId);
    assert.strictEqual(result.status, 'ACTIVE');

    assert.ok(txManager.committed);
    assert.strictEqual(targetRepo.moderationRecords.length, 1);
    assert.strictEqual(targetRepo.moderationRecords[0].action, 'UNLOCK');
    assert.strictEqual(auditPort.auditRecords.length, 1);
    assert.strictEqual(auditPort.auditRecords[0].action, 'UNLOCK_USER');
  });
});
