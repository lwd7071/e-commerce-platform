import { randomUUID } from 'node:crypto';
import type { IAuditPort } from '../../../contracts/audit.port.ts';
import type {
  ITargetLookupRepository,
  ITransactionManager,
  ModerateTargetCommand,
  ModerationTargetType,
  UserStatusUpdateResult
} from '../domain/moderation.types.ts';
import { ALLOWED_MODERATION_TARGET_TYPES } from '../domain/moderation.types.ts';
import {
  ValidationFailedError,
  ReasonRequiredError,
  NotFoundError,
  InvalidStateTransitionError,
  AuditWriteFailedError
} from '../../../platform/errors/app-error.ts';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class ModerationService {
  constructor(
    private readonly targetRepo: ITargetLookupRepository,
    private readonly auditPort: IAuditPort,
    private readonly txManager: ITransactionManager
  ) {}

  /**
   * Main Moderation Command Handler implementing strict 6-step verification order:
   * 1. Target Type Check (422)
   * 2. Target ID Structure / UUID Check (422)
   * 3. Reason Fail-Fast Check (422 REASON_REQUIRED, QD17)
   * 4. Target Existence Check in DB (404 RESOURCE_NOT_FOUND, RB-KN20)
   * 5. State / Idempotency Check (409 CONFLICT)
   * 6. Atomic Transaction Execution with Audit Logging (QD20)
   */
  public async moderateTarget(cmd: ModerateTargetCommand): Promise<UserStatusUpdateResult> {
    // 1. Bước 1 (Payload Type)
    if (!ALLOWED_MODERATION_TARGET_TYPES.includes(cmd.target_type as ModerationTargetType)) {
      throw new ValidationFailedError(
        `Invalid target_type '${cmd.target_type}'. Allowed types: ${ALLOWED_MODERATION_TARGET_TYPES.join(', ')}`
      );
    }

    // 2. Bước 2 (Payload Structure)
    if (!cmd.target_id || typeof cmd.target_id !== 'string' || !UUID_REGEX.test(cmd.target_id.trim())) {
      throw new ValidationFailedError(`Invalid target_id '${cmd.target_id}'. Target ID must be a valid UUID.`);
    }

    // 3. Bước 3 (Payload Reason fail-fast, QD17)
    if (!cmd.reason || typeof cmd.reason !== 'string' || cmd.reason.trim().length === 0) {
      throw new ReasonRequiredError('Reason is required for moderation action');
    }

    const cleanTargetId = cmd.target_id.trim();
    const cleanReason = cmd.reason.trim();

    // 4. Bước 4 (Database Existence Check, RB-KN20)
    await this.verifyTargetExists(cmd.target_type, cleanTargetId);

    // 5. Bước 5 (State & Idempotency Check)
    if (cmd.target_type === 'USER') {
      const currentStatus = await this.targetRepo.getUserStatus(cleanTargetId);
      if (cmd.action === 'LOCK' && currentStatus === 'LOCKED') {
        throw new InvalidStateTransitionError('USER_ALREADY_LOCKED', 'User is already locked');
      }
      if (cmd.action === 'UNLOCK' && currentStatus === 'ACTIVE') {
        throw new InvalidStateTransitionError('USER_ALREADY_ACTIVE', 'User is already active');
      }
    }

    // 6. Bước 6 (Atomic Transaction Execution, QD20)
    return await this.txManager.withTransaction(async (trx) => {
      let updateResult: UserStatusUpdateResult = {
        user_id: cleanTargetId,
        status: cmd.action === 'LOCK' ? 'LOCKED' : 'ACTIVE',
        updated_at: new Date().toISOString()
      };

      if (cmd.target_type === 'USER') {
        const newStatus = cmd.action === 'LOCK' ? 'LOCKED' : 'ACTIVE';
        updateResult = await this.targetRepo.updateUserStatus(trx, cleanTargetId, newStatus);
      }

      // Record in moderation_records
      await this.targetRepo.insertModerationRecord(trx, {
        moderation_id: randomUUID(),
        target_type: cmd.target_type,
        target_id: cleanTargetId,
        reason: cleanReason,
        action: cmd.action,
        admin_id: cmd.admin_id
      });

      // Record in admin_logs via IAuditPort
      try {
        await this.auditPort.logAdminAction(trx, {
          admin_id: cmd.admin_id,
          action: `${cmd.action}_${cmd.target_type}`,
          target_type: cmd.target_type,
          target_id: cleanTargetId,
          reason: cleanReason
        });
      } catch (auditError) {
        // Strict QD20: If audit fails, transaction MUST roll back and surface AUDIT_WRITE_FAILED (500)
        throw new AuditWriteFailedError('Failed to commit admin audit log', { cause: auditError });
      }

      return updateResult;
    });
  }

  public async lockUser(adminId: string, userId: string, reason: string): Promise<UserStatusUpdateResult> {
    return this.moderateTarget({
      admin_id: adminId,
      target_type: 'USER',
      target_id: userId,
      action: 'LOCK',
      reason
    });
  }

  public async unlockUser(adminId: string, userId: string, reason: string): Promise<UserStatusUpdateResult> {
    return this.moderateTarget({
      admin_id: adminId,
      target_type: 'USER',
      target_id: userId,
      action: 'UNLOCK',
      reason
    });
  }

  private async verifyTargetExists(targetType: ModerationTargetType, targetId: string): Promise<void> {
    let exists = false;
    switch (targetType) {
      case 'USER':
        exists = await this.targetRepo.userExists(targetId);
        break;
      case 'SHOP':
        exists = await this.targetRepo.shopExists(targetId);
        break;
      case 'PRODUCT':
        exists = await this.targetRepo.productExists(targetId);
        break;
      case 'REVIEW':
        exists = await this.targetRepo.reviewExists(targetId);
        break;
    }

    if (!exists) {
      throw new NotFoundError(`Target ${targetType} with ID '${targetId}' was not found`);
    }
  }
}
