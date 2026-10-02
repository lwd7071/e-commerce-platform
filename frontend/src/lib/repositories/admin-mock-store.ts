import type { AdminUserItem, AdminShopItem } from "./types";
import type { UserAccount, PlatformShop, ModerationReview, AdminAuditLog } from "@/features/admin/admin.types";

export const initialAdminUsers: (AdminUserItem & { lock_reason?: string | null })[] = [
  {
    id: "usr_001",
    email: "buyer1@example.com",
    full_name: "Nguyễn Văn A",
    role: "BUYER",
    status: "ACTIVE",
    created_at: "2026-01-10T08:00:00Z",
  },
  {
    id: "usr_002",
    email: "seller1@dino.vn",
    full_name: "Dino Beauty Store",
    role: "SELLER",
    status: "ACTIVE",
    created_at: "2026-01-15T09:30:00Z",
  },
  {
    id: "usr_003",
    email: "spambot99@fake.net",
    full_name: "Spam Bot Account",
    role: "BUYER",
    status: "LOCKED",
    lock_reason: "Spam bình luận và đặt đơn hàng ảo liên tục",
    created_at: "2026-02-12T14:20:00Z",
  },
  {
    id: "usr_004",
    email: "seller2@dino.vn",
    full_name: "Dino Tech Official",
    role: "SELLER",
    status: "ACTIVE",
    created_at: "2026-02-20T10:00:00Z",
  },
  {
    id: "usr_005",
    email: "admin@dino.vn",
    full_name: "Quản trị viên Hệ thống",
    role: "ADMIN",
    status: "ACTIVE",
    created_at: "2026-01-01T00:00:00Z",
  },
];

export const initialAdminShops: (AdminShopItem & { lock_reason?: string | null })[] = Array.from({ length: 20 }, (_, i) => {
  const num = String(i + 1).padStart(2, "0");
  const shopId = `00000000-0000-0000-0000-0000000000${num}`;

  if (i === 0) {
    return {
      shop_id: shopId,
      owner_id: "usr_002",
      shop_name: "Dino Beauty Official",
      description: "Gian hàng mỹ phẩm và chăm sóc sắc đẹp chính hãng",
      logo_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400",
      pickup_address: "123 Đường Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM",
      contact_phone: "0901234567",
      status: "PENDING",
      product_count: 18,
      owner_email: "seller1@dino.vn",
      owner_name: "Dino Beauty Seller",
      created_at: "2026-01-15T09:30:00Z",
      updated_at: "2026-01-15T09:30:00Z",
    };
  }

  if (i === 1) {
    return {
      shop_id: shopId,
      owner_id: "usr_004",
      shop_name: "Dino Tech Store",
      description: "Phụ kiện công nghệ, đồ điện tử và bàn phím cơ",
      logo_url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400",
      pickup_address: "456 Đường Cách Mạng Tháng 8, Quận 3, TP.HCM",
      contact_phone: "0909876543",
      status: "PENDING",
      product_count: 24,
      owner_email: "seller2@dino.vn",
      owner_name: "Dino Tech Seller",
      created_at: "2026-02-20T10:00:00Z",
      updated_at: "2026-02-20T10:00:00Z",
    };
  }

  if (i === 2) {
    return {
      shop_id: shopId,
      owner_id: "usr_003",
      shop_name: "Cửa Hàng Hàng Giả Kém Chất Lượng",
      description: "Gian hàng vi phạm chính sách hàng nhái",
      logo_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
      pickup_address: "789 Đường Lê Duẩn, Quận 1, TP.HCM",
      contact_phone: "0912345678",
      status: "LOCKED",
      lock_reason: "Bán hàng nhái, vi phạm quyền sở hữu trí tuệ",
      product_count: 3,
      owner_email: "fakevendor@bad.com",
      owner_name: "Fake Vendor",
      created_at: "2026-03-01T11:00:00Z",
      updated_at: "2026-03-01T11:00:00Z",
    };
  }

  // Shops 4 to 8 are ACTIVE by default (5 active shops initially)
  const isActive = i >= 3 && i < 8;

  return {
    shop_id: shopId,
    owner_id: `usr_seller_${num}`,
    shop_name: `Dino Demo Shop ${num}`,
    description: `Gian hàng thời trang và phong cách sống demo ${num}`,
    logo_url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400",
    pickup_address: "123 Đường Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM",
    contact_phone: "0901234567",
    status: isActive ? "ACTIVE" : "PENDING",
    product_count: i < 5 ? 5 : 2,
    owner_email: `seller${num}@dino-demo.test`,
    owner_name: `Demo Seller ${num}`,
    created_at: new Date(Date.now() - (20 - i) * 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - (20 - i) * 3600000 * 4).toISOString(),
  };
});

export const initialAdminAuditLogs: AdminAuditLog[] = [
  {
    id: "log_001",
    action: "LOCK_USER",
    targetType: "USER",
    targetId: "usr_003",
    targetName: "Spam Bot Account",
    reason: "Spam bình luận và đặt đơn hàng ảo liên tục",
    actor: "admin@dino.vn",
    createdAt: "2026-03-12T15:00:00Z",
  },
  {
    id: "log_002",
    action: "LOCK_SHOP",
    targetType: "SHOP",
    targetId: "00000000-0000-0000-0000-000000000003",
    targetName: "Cửa Hàng Hàng Giả Kém Chất Lượng",
    reason: "Bán hàng nhái, vi phạm quyền sở hữu trí tuệ",
    actor: "admin@dino.vn",
    createdAt: "2026-03-02T10:30:00Z",
  },
  {
    id: "log_003",
    action: "HIDE_PRODUCT",
    targetType: "PRODUCT",
    targetId: "prod_mod_03",
    targetName: "Nước hoa nhái thương hiệu cao cấp",
    reason: "Hàng giả nhái thương hiệu quốc tế",
    actor: "admin@dino.vn",
    createdAt: "2026-03-02T10:35:00Z",
  },
];

export const initialModerationReviews: ModerationReview[] = [
  {
    id: "rev_mod_01",
    productId: "00000000-0000-0000-0000-000000000101",
    productName: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
    buyerId: "usr_001",
    rating: 5,
    content: "Sản phẩm chất lượng vượt mong đợi, đóng gói rất cẩn thận!",
    status: "VISIBLE",
    createdAt: "2026-09-01T10:00:00Z",
  },
  {
    id: "rev_mod_02",
    productId: "00000000-0000-0000-0000-000000000102",
    productName: "Kem Chống Nắng Phổ Rộng SPF 50+ PA++++",
    buyerId: "usr_003",
    rating: 1,
    content: "Hàng giả lừa đảo mọi người đừng mua! Hãy click link fake.xyz để nhận quà!",
    status: "VISIBLE",
    createdAt: "2026-09-05T14:30:00Z",
  },
  {
    id: "rev_mod_03",
    productId: "00000000-0000-0000-0000-000000000104",
    productName: "Bàn Phím Cơ Không Dây 3 Chế Độ RGB",
    buyerId: "usr_002",
    rating: 2,
    content: "Bình luận chứa từ ngữ thô tục xúc phạm cửa hàng",
    status: "HIDDEN",
    createdAt: "2026-09-10T16:00:00Z",
  },
];

// Single shared mutable in-memory stores
export const mockAdminUsersStore: (AdminUserItem & { lock_reason?: string | null })[] =
  initialAdminUsers.map((u) => ({ ...u }));

export const mockAdminShopsStore: (AdminShopItem & { lock_reason?: string | null })[] =
  initialAdminShops.map((s) => ({ ...s }));

export const mockAdminAuditLogsStore: AdminAuditLog[] =
  initialAdminAuditLogs.map((l) => ({ ...l }));

export const mockAdminReviewsStore: ModerationReview[] =
  initialModerationReviews.map((r) => ({ ...r }));

/**
 * Record an audit log into the unified admin audit log store.
 */
export function recordAdminAuditLog(log: Omit<AdminAuditLog, "id" | "createdAt"> & { id?: string; createdAt?: string }): AdminAuditLog {
  const newLog: AdminAuditLog = {
    id: log.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    targetName: log.targetName,
    reason: log.reason,
    actor: log.actor || "admin@dino.vn",
    createdAt: log.createdAt || new Date().toISOString(),
  };
  mockAdminAuditLogsStore.unshift(newLog);
  return newLog;
}

/**
 * Reset all admin stores back to their initial seeded fixtures.
 */
export function resetAdminMockStores() {
  mockAdminUsersStore.length = 0;
  initialAdminUsers.forEach((u) => mockAdminUsersStore.push({ ...u }));

  mockAdminShopsStore.length = 0;
  initialAdminShops.forEach((s) => mockAdminShopsStore.push({ ...s }));

  mockAdminAuditLogsStore.length = 0;
  initialAdminAuditLogs.forEach((l) => mockAdminAuditLogsStore.push({ ...l }));

  mockAdminReviewsStore.length = 0;
  initialModerationReviews.forEach((r) => mockAdminReviewsStore.push({ ...r }));
}

/**
 * Adapter converting AdminShopItem to PlatformShop.
 */
export function toPlatformShop(item: AdminShopItem & { lock_reason?: string | null }): PlatformShop {
  return {
    id: item.shop_id,
    name: item.shop_name,
    ownerEmail: item.owner_email || "",
    productCount: item.product_count,
    status: item.status as PlatformShop["status"],
    lockReason: item.status === "LOCKED" ? item.lock_reason || "Bị khóa bởi quản trị viên" : null,
    createdAt: item.created_at,
  };
}

/**
 * Adapter converting AdminUserItem to UserAccount.
 */
export function toUserAccount(item: AdminUserItem & { lock_reason?: string | null }): UserAccount {
  return {
    id: item.id,
    email: item.email,
    fullName: item.full_name,
    role: item.role,
    status: item.status,
    lockReason: item.status === "LOCKED" ? item.lock_reason || "Tài khoản bị tạm khóa bởi quản trị viên" : null,
    createdAt: item.created_at,
  };
}
