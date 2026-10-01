import type { UserStatus } from '../../identity/domain/types.ts';
export type { UserStatus };
export type { IAuditPort, AdminAuditRecord } from '../../../contracts/audit.port.ts';

export const ALLOWED_MODERATION_TARGET_TYPES = ['USER', 'SHOP', 'PRODUCT', 'REVIEW'] as const;
export type ModerationTargetType = typeof ALLOWED_MODERATION_TARGET_TYPES[number];

export type ModerationAction = 'LOCK' | 'UNLOCK' | 'HIDE' | 'RESTORE' | 'APPROVE';

export type ShopStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
export type ModeratedContentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'VISIBLE' | 'HIDDEN';
export type ModerationTargetStatus = UserStatus | ShopStatus | ModeratedContentStatus;

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
  status: ModerationTargetStatus;
  updated_at: string;
  shop_id?: string;
  product_id?: string;
  review_id?: string;
}

export interface ShopStatusUpdateResult {
  shop_id: string;
  status: ShopStatus;
  updated_at: string;
}

export interface AdminShopItem {
  shop_id: string;
  owner_id: string;
  shop_name: string;
  description: string | null;
  logo_url: string | null;
  pickup_address: string | null;
  contact_phone: string | null;
  status: ShopStatus;
  product_count: number;
  owner_email?: string;
  owner_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface AdminModerationProduct {
  product_id: string;
  product_name: string;
  shop_name: string;
  min_price: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'HIDDEN';
  created_at: string;
}

export interface AdminModerationReview {
  review_id: string;
  product_id: string;
  product_name: string;
  buyer_id: string;
  rating: number;
  content: string | null;
  status: 'VISIBLE' | 'HIDDEN';
  created_at: string;
}

export interface ITargetLookupRepository {
  userExists(userId: string): Promise<boolean>;
  getUserStatus(userId: string): Promise<UserStatus | null>;
  getUserRole?(userId: string): Promise<'BUYER' | 'SELLER' | 'ADMIN' | null>;
  updateUserStatus(trx: unknown, userId: string, status: UserStatus): Promise<UserStatusUpdateResult>;
  shopExists(shopId: string): Promise<boolean>;
  getShopStatus?(shopId: string): Promise<ShopStatus | null>;
  hasRequiredShopProfile(trx: unknown, shopId: string): Promise<boolean>;
  updateShopStatus(trx: unknown, shopId: string, status: ShopStatus): Promise<ShopStatusUpdateResult>;
  productExists(productId: string): Promise<boolean>;
  reviewExists(reviewId: string): Promise<boolean>;
  getProductStatus?(productId: string): Promise<ModeratedContentStatus | null>;
  updateProductStatus?(trx: unknown, productId: string, status: 'ACTIVE' | 'HIDDEN'): Promise<{ product_id: string; status: 'ACTIVE' | 'HIDDEN'; updated_at: string }>;
  getReviewStatus?(reviewId: string): Promise<ModeratedContentStatus | null>;
  updateReviewStatus?(trx: unknown, reviewId: string, status: 'VISIBLE' | 'HIDDEN'): Promise<{ review_id: string; status: 'VISIBLE' | 'HIDDEN'; updated_at: string }>;
  insertModerationRecord(trx: unknown, record: ModerationRecord): Promise<void>;
  listShops?(params?: { status?: string; search?: string }): Promise<AdminShopItem[]>;
  listUsers?(params?: { role?: string; status?: string; search?: string }): Promise<AdminUserItem[]>;
  listModerationProducts?(params?: { status?: string; search?: string }): Promise<AdminModerationProduct[]>;
  listModerationReviews?(params?: { status?: string; search?: string }): Promise<AdminModerationReview[]>;
  getUserDetail?(userId: string): Promise<AdminUserItem | null>;
  getShopDetail?(shopId: string): Promise<AdminShopItem | null>;
}

export interface ITransactionManager {
  withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T>;
}

export interface IModerationService {
  moderateTarget(command: ModerateTargetCommand): Promise<UserStatusUpdateResult & { shop_id?: string }>;
  lockUser(adminId: string, userId: string, reason: string): Promise<UserStatusUpdateResult>;
  unlockUser(adminId: string, userId: string, reason: string): Promise<UserStatusUpdateResult>;
  approveShop?(adminId: string, shopId: string, reason?: string): Promise<ShopStatusUpdateResult>;
  lockShop?(adminId: string, shopId: string, reason: string): Promise<ShopStatusUpdateResult>;
  unlockShop?(adminId: string, shopId: string, reason?: string): Promise<ShopStatusUpdateResult>;
  listShops?(params?: { status?: string; search?: string }): Promise<AdminShopItem[]>;
  listUsers?(params?: { role?: string; status?: string; search?: string }): Promise<AdminUserItem[]>;
  listModerationProducts?(params?: { status?: string; search?: string }): Promise<AdminModerationProduct[]>;
  listModerationReviews?(params?: { status?: string; search?: string }): Promise<AdminModerationReview[]>;
  getUserDetail?(userId: string): Promise<AdminUserItem | null>;
  getShopDetail?(shopId: string): Promise<AdminShopItem | null>;
}
