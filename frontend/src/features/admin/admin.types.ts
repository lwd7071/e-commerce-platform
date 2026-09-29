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
  status: "ACTIVE" | "LOCKED";
  lockReason?: string | null;
  createdAt: string;
}

export interface ModerationProduct {
  id: string;
  name: string;
  shopName: string;
  price: string;
  status: "ACTIVE" | "HIDDEN";
  reports: number;
  reportReason?: string | null;
}

export interface AdminAuditLog {
  id: string;
  action: "LOCK_USER" | "UNLOCK_USER" | "LOCK_SHOP" | "UNLOCK_SHOP" | "HIDE_PRODUCT" | "RESTORE_PRODUCT" | "CREATE_CATEGORY" | "UPDATE_CATEGORY" | "DELETE_CATEGORY";
  targetType: "USER" | "SHOP" | "PRODUCT" | "CATEGORY";
  targetId: string;
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
