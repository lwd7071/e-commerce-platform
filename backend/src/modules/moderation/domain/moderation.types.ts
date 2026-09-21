import type { UserStatus } from '../../identity/domain/types.ts';

export const ALLOWED_MODERATION_TARGET_TYPES = ['USER', 'SHOP', 'PRODUCT', 'REVIEW'] as const;
export type ModerationTargetType = typeof ALLOWED_MODERATION_TARGET_TYPES[number];

export type ModerationAction = 'LOCK' | 'UNLOCK' | 'HIDE' | 'RESTORE';

export interface ModerationRecord {
  moderation_id: string;
  target_type: ModerationTargetType;
  target_id: string;
  reason: string;
  action: ModerationAction | string;
  admin_id: string;
  created_at?: string;
}

export interface ModerateTargetCommand {
  admin_id: string;
  target_type: ModerationTargetType;
  target_id: string;
  action: ModerationAction | string;
  reason: string;
}

export interface UserStatusUpdateResult {
  user_id: string;
  status: UserStatus;
  updated_at: string;
}

export interface ITargetLookupRepository {
  userExists(userId: string): Promise<boolean>;
  getUserStatus(userId: string): Promise<UserStatus | null>;
  updateUserStatus(trx: unknown, userId: string, status: UserStatus): Promise<UserStatusUpdateResult>;
  shopExists(shopId: string): Promise<boolean>;
  productExists(productId: string): Promise<boolean>;
  reviewExists(reviewId: string): Promise<boolean>;
  insertModerationRecord(trx: unknown, record: ModerationRecord): Promise<void>;
}

export interface ITransactionManager {
  withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T>;
}
