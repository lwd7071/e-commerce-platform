/**
 * Admin domain types for Dino E-Commerce (Người 5 - A-704, A-705, A-708, A-709, Q-805).
 */

export interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  status: "ACTIVE" | "LOCKED";
  lockReason?: string | null;
  createdAt: string;
}

export interface PlatformShop {
  id: string;
  name: string;
  ownerEmail: string;
  productCount: number;
  status: "PENDING" | "ACTIVE" | "LOCKED";
  lockReason?: string | null;
  createdAt: string;
}

export interface ModerationProduct {
  id: string;
  name: string;
  shopName: string;
  price: string;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "HIDDEN";
}

export interface ModerationReview {
  id: string;
  productId: string;
  productName: string;
  buyerId: string;
  rating: number;
  content: string | null;
  status: "VISIBLE" | "HIDDEN";
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  action: "LOCK_USER" | "UNLOCK_USER" | "LOCK_SHOP" | "UNLOCK_SHOP" | "HIDE_PRODUCT" | "RESTORE_PRODUCT" | "HIDE_REVIEW" | "RESTORE_REVIEW" | "CREATE_CATEGORY" | "UPDATE_CATEGORY" | string;
  targetType: "USER" | "SHOP" | "PRODUCT" | "REVIEW" | "CATEGORY" | "ORDER" | "VOUCHER" | "CAMPAIGN" | null;
  targetId: string | null;
  targetName?: string;
  reason: string;
  actor: string;
  createdAt: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalShops: number;
  totalProducts: number;
  platformGMV: string; // Complies with QD19: only COMPLETED orders count
}

export interface SellerKPIStats {
  shopId: string;
  shopName: string;
  totalRevenue: string; // QD19 compliant
  completedOrdersCount: number;
  pendingOrdersCount: number;
  activeProductsCount: number;
  averageRating: number;
}
