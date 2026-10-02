import { randomUUID } from 'node:crypto';
import type { IAuditPort } from '../../../contracts/audit.port.ts';
import type {
  AdminShopItem,
  AdminUserItem,
  AdminModerationProduct,
  AdminModerationReview,
  ITargetLookupRepository,
  ITransactionManager,
  ModerateTargetCommand,
  ModerationTargetType,
  ShopStatusUpdateResult,
  UserStatus,
  UserStatusUpdateResult
} from '../domain/moderation.types.ts';
import { ALLOWED_MODERATION_TARGET_TYPES } from '../domain/moderation.types.ts';
import {
  ValidationFailedError,
  ReasonRequiredError,
  NotFoundError,
  InvalidStateTransitionError,
  AuditWriteFailedError,
  AdminTargetProtectedError
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
  public async moderateTarget(cmd: ModerateTargetCommand): Promise<UserStatusUpdateResult & { shop_id?: string }> {
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
      if (this.targetRepo.getUserRole) {
        const role = await this.targetRepo.getUserRole(cleanTargetId);
        if (role === 'ADMIN') {
          throw new AdminTargetProtectedError('Cannot moderate an admin account');
        }
      }

      const currentStatus = await this.targetRepo.getUserStatus(cleanTargetId);
      if (cmd.action === 'LOCK' && currentStatus === 'LOCKED') {
        throw new InvalidStateTransitionError('USER_ALREADY_LOCKED', 'User is already locked');
      }
      if (cmd.action === 'UNLOCK' && currentStatus === 'ACTIVE') {
        throw new InvalidStateTransitionError('USER_ALREADY_ACTIVE', 'User is already active');
      }
    } else if (cmd.target_type === 'SHOP') {
      const currentStatus = this.targetRepo.getShopStatus
        ? await this.targetRepo.getShopStatus(cleanTargetId)
        : null;
      if (currentStatus) {
        if ((cmd.action === 'APPROVE' || cmd.action === 'UNLOCK') && currentStatus === 'ACTIVE') {
          throw new InvalidStateTransitionError('SHOP_ALREADY_ACTIVE', 'Shop is already active');
        }
        if (cmd.action === 'LOCK' && currentStatus === 'LOCKED') {
          throw new InvalidStateTransitionError('SHOP_ALREADY_LOCKED', 'Shop is already locked');
        }
      }
    } else if (cmd.target_type === 'PRODUCT') {
      const currentStatus = await this.targetRepo.getProductStatus?.(cleanTargetId);
      if (cmd.action === 'HIDE' && currentStatus !== 'ACTIVE') {
        throw new InvalidStateTransitionError('PRODUCT_NOT_ACTIVE', 'Only active products can be hidden');
      }
      if (cmd.action === 'RESTORE' && currentStatus !== 'HIDDEN') {
        throw new InvalidStateTransitionError('PRODUCT_NOT_HIDDEN', 'Only hidden products can be restored');
      }
    } else if (cmd.target_type === 'REVIEW') {
      const currentStatus = await this.targetRepo.getReviewStatus?.(cleanTargetId);
      if (cmd.action === 'HIDE' && currentStatus !== 'VISIBLE') {
        throw new InvalidStateTransitionError('REVIEW_NOT_VISIBLE', 'Only visible reviews can be hidden');
      }
      if (cmd.action === 'RESTORE' && currentStatus !== 'HIDDEN') {
        throw new InvalidStateTransitionError('REVIEW_NOT_HIDDEN', 'Only hidden reviews can be restored');
      }
    }

    // 6. Bước 6 (Atomic Transaction Execution, QD20)
    return await this.txManager.withTransaction(async (trx) => {
      let updateResult: UserStatusUpdateResult & { shop_id?: string } = {
        user_id: cleanTargetId,
        status: cmd.action === 'LOCK' ? 'LOCKED' : 'ACTIVE',
        updated_at: new Date().toISOString()
      };

      if (cmd.target_type === 'USER') {
        const newStatus = cmd.action === 'LOCK' ? 'LOCKED' : 'ACTIVE';
        updateResult = await this.targetRepo.updateUserStatus(trx, cleanTargetId, newStatus);
      } else if (cmd.target_type === 'SHOP') {
        if (cmd.action === 'APPROVE' && !(await this.targetRepo.hasRequiredShopProfile(trx, cleanTargetId))) {
          throw new ValidationFailedError('Shop requires a pickup address and contact phone before approval', {
            fields: ['pickup_address', 'contact_phone'],
          });
        }
        const newShopStatus = cmd.action === 'LOCK' ? 'LOCKED' : 'ACTIVE';
        const shopRes = await this.targetRepo.updateShopStatus(trx, cleanTargetId, newShopStatus);
        updateResult = {
          user_id: cleanTargetId,
          shop_id: shopRes.shop_id,
          status: (shopRes.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE') as unknown as UserStatus,
          updated_at: shopRes.updated_at
        };
      } else if (cmd.target_type === 'PRODUCT' && this.targetRepo.updateProductStatus) {
        const productRes = await this.targetRepo.updateProductStatus(trx, cleanTargetId, cmd.action === 'HIDE' ? 'HIDDEN' : 'ACTIVE');
        updateResult = { user_id: cleanTargetId, product_id: productRes.product_id, status: productRes.status, updated_at: productRes.updated_at };
      } else if (cmd.target_type === 'REVIEW' && this.targetRepo.updateReviewStatus) {
        const reviewRes = await this.targetRepo.updateReviewStatus(trx, cleanTargetId, cmd.action === 'HIDE' ? 'HIDDEN' : 'VISIBLE');
        updateResult = { user_id: cleanTargetId, review_id: reviewRes.review_id, status: reviewRes.status, updated_at: reviewRes.updated_at };
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

  public async approveShop(adminId: string, shopId: string, reason = 'Shop approved by admin'): Promise<ShopStatusUpdateResult> {
    const res = await this.moderateTarget({
      admin_id: adminId,
      target_type: 'SHOP',
      target_id: shopId,
      action: 'APPROVE',
      reason
    });
    return {
      shop_id: res.shop_id || shopId,
      status: 'ACTIVE',
      updated_at: res.updated_at
    };
  }

  public async lockShop(adminId: string, shopId: string, reason: string): Promise<ShopStatusUpdateResult> {
    const res = await this.moderateTarget({
      admin_id: adminId,
      target_type: 'SHOP',
      target_id: shopId,
      action: 'LOCK',
      reason
    });
    return {
      shop_id: res.shop_id || shopId,
      status: 'LOCKED',
      updated_at: res.updated_at
    };
  }

  public async unlockShop(adminId: string, shopId: string, reason = 'Shop unlocked by admin'): Promise<ShopStatusUpdateResult> {
    const res = await this.moderateTarget({
      admin_id: adminId,
      target_type: 'SHOP',
      target_id: shopId,
      action: 'UNLOCK',
      reason
    });
    return {
      shop_id: res.shop_id || shopId,
      status: 'ACTIVE',
      updated_at: res.updated_at
    };
  }

  public async listShops(params?: { status?: string; search?: string }): Promise<AdminShopItem[]> {
    if (this.targetRepo.listShops) {
      return this.targetRepo.listShops(params);
    }
    return [];
  }

  public async listUsers(params?: { role?: string; status?: string; search?: string }): Promise<AdminUserItem[]> {
    if (this.targetRepo.listUsers) {
      return this.targetRepo.listUsers(params);
    }
    return [];
  }

  public async listModerationProducts(params?: { status?: string; search?: string }): Promise<AdminModerationProduct[]> {
    return this.targetRepo.listModerationProducts?.(params) ?? [];
  }

  public async listModerationReviews(params?: { status?: string; search?: string }): Promise<AdminModerationReview[]> {
    return this.targetRepo.listModerationReviews?.(params) ?? [];
  }

  public async getUserDetail(userId: string): Promise<AdminUserItem | null> {
    return this.targetRepo.getUserDetail?.(userId) ?? null;
  }

  public async getShopDetail(shopId: string): Promise<AdminShopItem | null> {
    return this.targetRepo.getShopDetail?.(shopId) ?? null;
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
