import { apiClient } from "@/lib/api/client";
import { features } from "@/lib/config/features";
import { DEV_CATEGORY_FIXTURES, type CategoryItem, type CategoryTreeNode } from "@/lib/adapters/category.adapter";
import {
  mockOrderRepository,
} from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import {
  mockAdminUsersStore,
  mockAdminShopsStore,
  mockAdminAuditLogsStore,
  mockAdminReviewsStore,
  resetAdminMockStores,
  recordAdminAuditLog,
  toPlatformShop,
  toUserAccount,
} from "@/lib/repositories/admin-mock-store";
import type {
  UserAccount,
  PlatformShop,
  ModerationProduct,
  ModerationReview,
  AdminAuditLog,
  DashboardStats,
} from "./admin.types";

export interface IAdminRepository {
  getDashboardStats(): Promise<DashboardStats>;
  getUsers(): Promise<UserAccount[]>;
  getUserDetail(userId: string): Promise<UserAccount>;
  getUsersPage(params?: { status?: string; role?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: UserAccount[]; next_cursor: string | null; has_more: boolean }>;
  lockUser(userId: string, reason: string, actor?: string): Promise<UserAccount>;
  unlockUser(userId: string, actor?: string): Promise<UserAccount>;
  getShops(): Promise<PlatformShop[]>;
  getShopDetail(shopId: string): Promise<PlatformShop & { contactPhone?: string | null; pickupAddress?: string | null; description?: string | null }>;
  getShopsPage(params?: { status?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: PlatformShop[]; next_cursor: string | null; has_more: boolean }>;
  approveShop(shopId: string, reason?: string, actor?: string): Promise<PlatformShop>;
  lockShop(shopId: string, reason: string, actor?: string): Promise<PlatformShop>;
  unlockShop(shopId: string, actor?: string): Promise<PlatformShop>;
  getModerationProducts(): Promise<ModerationProduct[]>;
  getModerationReviews(): Promise<ModerationReview[]>;
  moderateReview(reviewId: string, status: "VISIBLE" | "HIDDEN", reason: string): Promise<ModerationReview>;
  moderateProduct(
    productId: string,
    status: "ACTIVE" | "HIDDEN",
    reason?: string,
    actor?: string
  ): Promise<ModerationProduct>;
  getAuditLogs(): Promise<AdminAuditLog[]>;

  // Category management (A-709)
  getCategories(): Promise<CategoryItem[]>;
  getCategoryTree(): Promise<CategoryTreeNode[]>;
  createCategory(input: {
    name: string;
    parentId?: string | null;
    description?: string | null;
  }): Promise<CategoryItem>;
  updateCategory(id: string, input: { name?: string; parentId?: string | null; description?: string | null }): Promise<CategoryItem>;
  toggleCategoryStatus(id: string): Promise<CategoryItem>;
}

// Initial moderation products
const initialModerationProducts: ModerationProduct[] = [
  {
    id: "prod_mod_01",
    name: "Serum Dưỡng Trắng & Cấp Ẩm Chuyên Sâu",
    shopName: "Dino Beauty Official",
    price: "280000.00",
    status: "ACTIVE",
  },
  {
    id: "prod_mod_02",
    name: "Bàn Phím Cơ Không Dây 3 Chế Độ RGB",
    shopName: "Dino Tech Store",
    price: "850000.00",
    status: "ACTIVE",
  },
  {
    id: "prod_mod_03",
    name: "Nước hoa nhái thương hiệu cao cấp",
    shopName: "Cửa Hàng Hàng Giả Kém Chất Lượng",
    price: "99000.00",
    status: "HIDDEN",
  },
];

let mockProducts = [...initialModerationProducts];
const initialCategoryFixtures: CategoryItem[] = [
  {
    id: "00000000-0000-0000-0000-000000000010",
    parentId: null,
    name: "Mỹ phẩm & Chăm sóc sắc đẹp",
    description: "Sản phẩm chăm sóc da và làm đẹp chính hãng",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    parentId: null,
    name: "Thời trang & Phụ kiện",
    description: "Quần áo, giày dép thời trang",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    parentId: null,
    name: "Thiết bị điện tử",
    description: "Điện thoại, bàn phím và phụ kiện công nghệ",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000110",
    parentId: "00000000-0000-0000-0000-000000000010",
    name: "Chăm sóc da mặt & Serum",
    description: "Serum, kem dưỡng, mặt nạ chuyên sâu",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000111",
    parentId: "00000000-0000-0000-0000-000000000011",
    name: "Áo sơ mi & Áo thun nam",
    description: "Trang phục nam cao cấp",
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-0000-0000-000000000112",
    parentId: "00000000-0000-0000-0000-000000000012",
    name: "Phụ kiện máy tính & Bàn phím",
    description: "Bàn phím cơ, chuột và tai nghe",
    status: "ACTIVE",
  },
];

let localCategories: CategoryItem[] = DEV_CATEGORY_FIXTURES;

export function resetMockAdminStore() {
  resetAdminMockStores();
  mockProducts = [...initialModerationProducts];
  DEV_CATEGORY_FIXTURES.length = 0;
  initialCategoryFixtures.forEach((c) => DEV_CATEGORY_FIXTURES.push({ ...c }));
  localCategories = DEV_CATEGORY_FIXTURES;
}

export class MockAdminRepository implements IAdminRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const orders = await mockOrderRepository.getOrders();
    // Rule QD19: Only COMPLETED orders contribute to platform GMV
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const totalGMV = completedOrders.reduce((sum, o) => {
      return sum + moneyAdapter.toInteger(o.total_amount);
    }, 0);

    const activeShops = mockAdminShopsStore.filter((s) => s.status === "ACTIVE").length;

    return {
      totalUsers: mockAdminUsersStore.length,
      totalShops: activeShops,
      totalProducts: mockProducts.length,
      platformGMV: totalGMV.toString(),
    };
  }

  async getUsers(): Promise<UserAccount[]> {
    return mockAdminUsersStore.map(toUserAccount);
  }

  async getUserDetail(userId: string): Promise<UserAccount> {
    const found = mockAdminUsersStore.find((u) => u.id === userId);
    if (!found) throw new Error("Không tìm thấy người dùng.");
    return toUserAccount(found);
  }

  async getUsersPage(params?: { status?: string; role?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: UserAccount[]; next_cursor: string | null; has_more: boolean }> {
    let list = mockAdminUsersStore.map(toUserAccount);
    if (params?.role && params.role !== "ALL") list = list.filter((u) => u.role === params.role);
    if (params?.status && params.status !== "ALL") list = list.filter((u) => u.status === params.status);
    if (params?.search?.trim()) {
      const q = params.search.toLowerCase();
      list = list.filter((u) => u.email.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q));
    }
    const limit = params?.limit ?? 20;
    return {
      items: list.slice(0, limit),
      next_cursor: list.length > limit ? "mock_next_cursor" : null,
      has_more: list.length > limit,
    };
  }

  async lockUser(userId: string, reason: string, actor = "admin@dino.vn"): Promise<UserAccount> {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Lý do khóa tài khoản là bắt buộc.");
    }
    const found = mockAdminUsersStore.find((u) => u.id === userId);
    if (!found) throw new Error("Không tìm thấy người dùng.");

    if (found.role === "ADMIN") {
      throw new Error("Không thể khóa tài khoản quản trị viên tối cao.");
    }

    found.status = "LOCKED";
    found.lock_reason = reason.trim();

    recordAdminAuditLog({
      action: "LOCK_USER",
      targetType: "USER",
      targetId: found.id,
      targetName: found.full_name || found.email,
      reason: reason.trim(),
      actor,
    });

    return toUserAccount(found);
  }

  async unlockUser(userId: string, actor = "admin@dino.vn"): Promise<UserAccount> {
    const found = mockAdminUsersStore.find((u) => u.id === userId);
    if (!found) throw new Error("Không tìm thấy người dùng.");

    found.status = "ACTIVE";
    found.lock_reason = null;

    recordAdminAuditLog({
      action: "UNLOCK_USER",
      targetType: "USER",
      targetId: found.id,
      targetName: found.full_name || found.email,
      reason: "Mở khóa tài khoản người dùng sau kiểm tra",
      actor,
    });

    return toUserAccount(found);
  }

  async getShops(): Promise<PlatformShop[]> {
    return mockAdminShopsStore.map(toPlatformShop);
  }

  async getShopDetail(shopId: string): Promise<PlatformShop & { contactPhone?: string | null; pickupAddress?: string | null; description?: string | null }> {
    const found = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");
    return {
      ...toPlatformShop(found),
      contactPhone: found.contact_phone || "0901234567",
      pickupAddress: found.pickup_address || "123 Đường Điện Biên Phủ, Phường 25, Quận Bình Thạnh, TP.HCM",
      description: found.description || "Gian hàng chính thức trên sàn Dino E-Commerce",
    };
  }

  async getShopsPage(params?: { status?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: PlatformShop[]; next_cursor: string | null; has_more: boolean }> {
    let list = mockAdminShopsStore.map(toPlatformShop);
    if (params?.status && params.status !== "ALL") list = list.filter((s) => s.status === params.status);
    if (params?.search?.trim()) {
      const q = params.search.toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.ownerEmail.toLowerCase().includes(q));
    }
    const limit = params?.limit ?? 20;
    return {
      items: list.slice(0, limit),
      next_cursor: list.length > limit ? "mock_next_shop_cursor" : null,
      has_more: list.length > limit,
    };
  }

  async approveShop(shopId: string, reason = "Shop verified and approved by admin", actor = "admin@dino.vn"): Promise<PlatformShop> {
    const found = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");
    if (found.status === "ACTIVE") throw new Error("Gian hàng đã ở trạng thái hoạt động");

    found.status = "ACTIVE";
    found.updated_at = new Date().toISOString();

    recordAdminAuditLog({
      action: "APPROVE_SHOP",
      targetType: "SHOP",
      targetId: found.shop_id,
      targetName: found.shop_name,
      reason: reason.trim() || "Shop verified and approved by admin",
      actor,
    });

    return toPlatformShop(found);
  }

  async lockShop(shopId: string, reason: string, actor = "admin@dino.vn"): Promise<PlatformShop> {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Lý do khóa gian hàng là bắt buộc.");
    }
    const found = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");

    found.status = "LOCKED";
    found.lock_reason = reason.trim();
    found.updated_at = new Date().toISOString();

    recordAdminAuditLog({
      action: "LOCK_SHOP",
      targetType: "SHOP",
      targetId: found.shop_id,
      targetName: found.shop_name,
      reason: reason.trim(),
      actor,
    });

    return toPlatformShop(found);
  }

  async unlockShop(shopId: string, actor = "admin@dino.vn"): Promise<PlatformShop> {
    const found = mockAdminShopsStore.find((s) => s.shop_id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");

    found.status = "ACTIVE";
    found.lock_reason = null;
    found.updated_at = new Date().toISOString();

    recordAdminAuditLog({
      action: "UNLOCK_SHOP",
      targetType: "SHOP",
      targetId: found.shop_id,
      targetName: found.shop_name,
      reason: "Mở khóa gian hàng sau khi hoàn tất xác minh",
      actor,
    });

    return toPlatformShop(found);
  }

  async getModerationProducts(): Promise<ModerationProduct[]> {
    return [...mockProducts];
  }

  async getModerationReviews(): Promise<ModerationReview[]> {
    return [...mockAdminReviewsStore];
  }

  async moderateReview(reviewId: string, status: "VISIBLE" | "HIDDEN", reason: string): Promise<ModerationReview> {
    const found = mockAdminReviewsStore.find((r) => r.id === reviewId);
    if (!found) throw new Error("Không tìm thấy đánh giá.");

    found.status = status;

    recordAdminAuditLog({
      action: status === "HIDDEN" ? "HIDE_REVIEW" : "RESTORE_REVIEW",
      targetType: "REVIEW",
      targetId: found.id,
      targetName: `Đánh giá cho sản phẩm ${found.productName}`,
      reason: reason.trim(),
      actor: "admin@dino.vn",
    });

    return { ...found };
  }

  async moderateProduct(
    productId: string,
    status: "ACTIVE" | "HIDDEN",
    reason?: string,
    actor = "admin@dino.vn"
  ): Promise<ModerationProduct> {
    const found = mockProducts.find((p) => p.id === productId);
    if (!found) throw new Error("Không tìm thấy sản phẩm.");

    found.status = status;

    recordAdminAuditLog({
      action: status === "HIDDEN" ? "HIDE_PRODUCT" : "RESTORE_PRODUCT",
      targetType: "PRODUCT",
      targetId: found.id,
      targetName: found.name,
      reason: reason || (status === "HIDDEN" ? "Ẩn sản phẩm do vi phạm" : "Khôi phục hiển thị sản phẩm"),
      actor,
    });

    return { ...found };
  }

  async getAuditLogs(): Promise<AdminAuditLog[]> {
    return [...mockAdminAuditLogsStore];
  }

  // Categories CRUD (A-709 consuming A-700 adapter)
  async getCategories(): Promise<CategoryItem[]> {
    if (localCategories.length === 0) {
      localCategories = DEV_CATEGORY_FIXTURES.map((c) => ({ ...c }));
    }
    return [...localCategories];
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const cats = await this.getCategories();
    // Build tree: max 2 levels per RB-KN04
    const rootNodes = cats.filter((c) => c.parentId === null);
    return rootNodes.map((root) => ({
      ...root,
      children: cats.filter((c) => c.parentId === root.id),
    }));
  }

  async createCategory(input: {
    name: string;
    parentId?: string | null;
    description?: string | null;
  }): Promise<CategoryItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error("Tên danh mục không được để trống.");
    }

    const cats = await this.getCategories();

    // Check 2 levels limit (RB-KN04)
    if (input.parentId) {
      const parent = cats.find((c) => c.id === input.parentId);
      if (!parent) throw new Error("Danh mục cha không tồn tại.");
      if (parent.parentId !== null) {
        throw new Error("Quy tắc RB-KN04: Danh mục chỉ được hỗ trợ tối đa 2 cấp phân cấp.");
      }
    }

    const newCat: CategoryItem = {
      id: `cat_${Date.now()}`,
      parentId: input.parentId || null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      status: "ACTIVE",
    };

    localCategories.push(newCat);

    recordAdminAuditLog({
      action: "CREATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: newCat.id,
      targetName: newCat.name,
      reason: "Thêm danh mục mới vào hệ sinh thái sàn",
      actor: "admin@dino.vn",
    });

    return newCat;
  }

  async toggleCategoryStatus(id: string): Promise<CategoryItem> {
    const cats = await this.getCategories();
    const found = cats.find((c) => c.id === id);
    if (!found) throw new Error("Không tìm thấy danh mục.");

    found.status = found.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    recordAdminAuditLog({
      action: "UPDATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: found.id,
      targetName: found.name,
      reason: `Đổi trạng thái danh mục sang ${found.status}`,
      actor: "admin@dino.vn",
    });

    return { ...found };
  }

  async updateCategory(id: string, input: { name?: string; parentId?: string | null; description?: string | null }): Promise<CategoryItem> {
    const cats = await this.getCategories();
    const found = cats.find((c) => c.id === id);
    if (!found) throw new Error("Không tìm thấy danh mục.");
    Object.assign(found, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });

    recordAdminAuditLog({
      action: "UPDATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: found.id,
      targetName: found.name,
      reason: "Cập nhật danh mục",
      actor: "admin@dino.vn",
    });

    return { ...found };
  }
}

export class ApiAdminRepository implements IAdminRepository {
  private moderationReviews: ModerationReview[] | null = null;
  async getDashboardStats(): Promise<DashboardStats> {
    return apiClient.get<DashboardStats>("/admin/stats");
  }

  async getUsers(): Promise<UserAccount[]> {
    const rows = await apiClient.get<Array<{ id: string; email: string; full_name: string; role: UserAccount["role"]; status: UserAccount["status"]; created_at: string }>>("/admin/users");
    return rows.map((row) => ({ id: row.id, email: row.email, fullName: row.full_name, role: row.role, status: row.status, createdAt: row.created_at }));
  }

  async getUserDetail(userId: string): Promise<UserAccount> {
    const row = await apiClient.get<{ id: string; email: string; full_name?: string; fullName?: string; role: UserAccount["role"]; status: UserAccount["status"]; created_at: string; updated_at?: string }>(`/admin/users/${userId}`);
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName || row.full_name || row.email.split("@")[0],
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  async getUsersPage(params?: { status?: string; role?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: UserAccount[]; next_cursor: string | null; has_more: boolean }> {
    const envelope = await apiClient.getPaginated<{ id: string; email: string; full_name?: string; fullName?: string; role: UserAccount["role"]; status: UserAccount["status"]; created_at: string }>("/admin/users", { params });
    return {
      items: (envelope.data || []).map((row) => ({
        id: row.id,
        email: row.email,
        fullName: row.fullName || row.full_name || row.email.split("@")[0],
        role: row.role,
        status: row.status,
        createdAt: row.created_at,
      })),
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
    };
  }

  async lockUser(userId: string, reason: string, actor?: string): Promise<UserAccount> {
    return apiClient.post<UserAccount>(`/admin/users/${userId}/lock`, { reason, actor });
  }

  async unlockUser(userId: string, actor?: string, reason = "Account unlocked by admin"): Promise<UserAccount> {
    return apiClient.post<UserAccount>(`/admin/users/${userId}/unlock`, { reason, actor });
  }

  async getShops(): Promise<PlatformShop[]> {
    const rows = await apiClient.get<Array<{ shop_id: string; shop_name: string; owner_email?: string; product_count: number; status: PlatformShop["status"]; created_at: string }>>("/admin/shops");
    return rows.map((row) => ({ id: row.shop_id, name: row.shop_name, ownerEmail: row.owner_email ?? "", productCount: Number(row.product_count), status: row.status, createdAt: row.created_at }));
  }

  async getShopDetail(shopId: string): Promise<PlatformShop & { contactPhone?: string | null; pickupAddress?: string | null; description?: string | null }> {
    const row = await apiClient.get<{
      id?: string;
      shop_id?: string;
      name?: string;
      shop_name?: string;
      ownerId?: string;
      owner_id?: string;
      ownerEmail?: string;
      owner_email?: string;
      productCount?: number;
      product_count?: number;
      contactPhone?: string | null;
      contact_phone?: string | null;
      pickupAddress?: string | null;
      pickup_address?: string | null;
      description?: string | null;
      status: PlatformShop["status"];
      createdAt?: string;
      created_at?: string;
    }>(`/admin/shops/${shopId}`);
    return {
      id: row.id || row.shop_id || shopId,
      name: row.name || row.shop_name || "Gian hàng",
      ownerEmail: row.ownerEmail || row.owner_email || "",
      productCount: Number(row.productCount ?? row.product_count ?? 0),
      status: row.status,
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      contactPhone: row.contactPhone ?? row.contact_phone ?? null,
      pickupAddress: row.pickupAddress ?? row.pickup_address ?? null,
      description: row.description ?? null,
    };
  }

  async getShopsPage(params?: { status?: string; search?: string; cursor?: string; limit?: number }): Promise<{ items: PlatformShop[]; next_cursor: string | null; has_more: boolean }> {
    const envelope = await apiClient.getPaginated<{ shop_id?: string; id?: string; shop_name?: string; name?: string; owner_email?: string; ownerEmail?: string; product_count?: number; productCount?: number; status: PlatformShop["status"]; created_at?: string; createdAt?: string }>("/admin/shops", { params });
    return {
      items: (envelope.data || []).map((row) => ({
        id: row.id || row.shop_id || "",
        name: row.name || row.shop_name || "",
        ownerEmail: row.ownerEmail || row.owner_email || "",
        productCount: Number(row.productCount ?? row.product_count ?? 0),
        status: row.status,
        createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      })),
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
    };
  }

  async approveShop(shopId: string, reason = "Shop approved by admin", actor?: string): Promise<PlatformShop> {
    await apiClient.post(`/admin/shops/${shopId}/approve`, { reason, actor });
    return this.getShopDetail(shopId);
  }

  async lockShop(shopId: string, reason: string, actor?: string): Promise<PlatformShop> {
    return apiClient.post<PlatformShop>(`/admin/shops/${shopId}/lock`, { reason, actor });
  }

  async unlockShop(shopId: string, actor?: string, reason = "Shop unlocked by admin"): Promise<PlatformShop> {
    return apiClient.post<PlatformShop>(`/admin/shops/${shopId}/unlock`, { reason, actor });
  }

  async getModerationProducts(): Promise<ModerationProduct[]> {
    const rows = await apiClient.get<Array<{ product_id: string; product_name: string; shop_name: string; min_price: string | null; status: "DRAFT" | "ACTIVE" | "INACTIVE" | "HIDDEN" }>>("/admin/products");
    return rows.map((row) => ({ id: row.product_id, name: row.product_name, shopName: row.shop_name, price: row.min_price ?? "0.00", status: row.status }));
  }

  async getModerationReviews(): Promise<ModerationReview[]> {
    const rows = await apiClient.get<Array<{ review_id: string; product_id: string; product_name: string; buyer_id: string; rating: number; content: string | null; status: "VISIBLE" | "HIDDEN"; created_at: string }>>("/admin/reviews");
    this.moderationReviews = rows.map((row) => ({ id: row.review_id, productId: row.product_id, productName: row.product_name, buyerId: row.buyer_id, rating: Number(row.rating), content: row.content, status: row.status, createdAt: row.created_at }));
    return this.moderationReviews;
  }

  async moderateReview(reviewId: string, status: "VISIBLE" | "HIDDEN", reason: string): Promise<ModerationReview> {
    const existing = (this.moderationReviews ?? await this.getModerationReviews()).find((review) => review.id === reviewId);
    if (!existing) throw new Error("Không tìm thấy đánh giá.");
    const result = await apiClient.patch<{ status: "VISIBLE" | "HIDDEN" }>(`/admin/reviews/${reviewId}/moderate`, { status, reason });
    const updated = { ...existing, status: result.status };
    this.moderationReviews = this.moderationReviews?.map((review) => review.id === reviewId ? updated : review) ?? null;
    return updated;
  }

  async moderateProduct(
    productId: string,
    status: "ACTIVE" | "HIDDEN",
    reason?: string,
    actor?: string
  ): Promise<ModerationProduct> {
    void actor;
    const existing = (await this.getModerationProducts()).find((product) => product.id === productId);
    if (!existing) throw new Error("Không tìm thấy sản phẩm.");
    const result = await apiClient.patch<{ product_id: string; status: "ACTIVE" | "HIDDEN" }>(`/admin/products/${productId}/moderate`, { status, reason });
    return { ...existing, status: result.status };
  }

  async getAuditLogs(): Promise<AdminAuditLog[]> {
    return apiClient.get<AdminAuditLog[]>("/admin/audit-logs");
  }

  async getCategories(): Promise<CategoryItem[]> {
    const rows = await apiClient.get<Array<{ category_id: string; parent_category_id: string | null; category_name: string; description: string | null; status: "ACTIVE" | "INACTIVE" }>>("/admin/categories");
    return rows.map((category) => ({
      id: category.category_id,
      parentId: category.parent_category_id,
      name: category.category_name,
      description: category.description,
      status: category.status,
    }));
  }

  async getCategoryTree(): Promise<CategoryTreeNode[]> {
    const categories = await this.getCategories();
    return categories
      .filter((category) => category.parentId === null)
      .map((root) => ({
        ...root,
        children: categories.filter((category) => category.parentId === root.id),
      }));
  }

  async createCategory(input: {
    name: string;
    parentId?: string | null;
    description?: string | null;
  }): Promise<CategoryItem> {
    const category = await apiClient.post<{ category_id: string; parent_category_id: string | null; category_name: string; description: string | null; status: "ACTIVE" | "INACTIVE" }>("/admin/categories", {
      name: input.name,
      parent_category_id: input.parentId ?? null,
      description: input.description ?? null,
    });
    return { id: category.category_id, parentId: category.parent_category_id, name: category.category_name, description: category.description, status: category.status };
  }

  async updateCategory(id: string, input: { name?: string; parentId?: string | null; description?: string | null }): Promise<CategoryItem> {
    const category = await apiClient.patch<{ category_id: string; parent_category_id: string | null; category_name: string; description: string | null; status: "ACTIVE" | "INACTIVE" }>(`/admin/categories/${id}`, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.parentId !== undefined ? { parent_category_id: input.parentId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    });
    return { id: category.category_id, parentId: category.parent_category_id, name: category.category_name, description: category.description, status: category.status };
  }

  async toggleCategoryStatus(id: string): Promise<CategoryItem> {
    const current = (await this.getCategories()).find((item) => item.id === id);
    if (!current) throw new Error("Không tìm thấy danh mục.");
    const category = await apiClient.patch<{ category_id: string; status: "ACTIVE" | "INACTIVE" }>(`/admin/categories/${id}/status`, {
      status: current.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
    return { ...current, status: category.status };
  }
}

export const mockAdminRepository = new MockAdminRepository();
export const apiAdminRepository = new ApiAdminRepository();

export const adminRepository: IAdminRepository = {
  getDashboardStats: () =>
    features.domains.adminMock() ? mockAdminRepository.getDashboardStats() : apiAdminRepository.getDashboardStats(),
  getUsers: () =>
    features.domains.adminMock() ? mockAdminRepository.getUsers() : apiAdminRepository.getUsers(),
  getUserDetail: (userId: string) =>
    features.domains.adminMock() ? mockAdminRepository.getUserDetail(userId) : apiAdminRepository.getUserDetail(userId),
  getUsersPage: (params) =>
    features.domains.adminMock() ? mockAdminRepository.getUsersPage(params) : apiAdminRepository.getUsersPage(params),
  lockUser: (userId, reason, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.lockUser(userId, reason, actor)
      : apiAdminRepository.lockUser(userId, reason, actor),
  unlockUser: (userId, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.unlockUser(userId, actor)
      : apiAdminRepository.unlockUser(userId, actor),
  getShops: () =>
    features.domains.adminMock() ? mockAdminRepository.getShops() : apiAdminRepository.getShops(),
  getShopDetail: (shopId: string) =>
    features.domains.adminMock() ? mockAdminRepository.getShopDetail(shopId) : apiAdminRepository.getShopDetail(shopId),
  getShopsPage: (params) =>
    features.domains.adminMock() ? mockAdminRepository.getShopsPage(params) : apiAdminRepository.getShopsPage(params),
  approveShop: (shopId, reason, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.approveShop(shopId, reason, actor)
      : apiAdminRepository.approveShop(shopId, reason, actor),
  lockShop: (shopId, reason, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.lockShop(shopId, reason, actor)
      : apiAdminRepository.lockShop(shopId, reason, actor),
  unlockShop: (shopId, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.unlockShop(shopId, actor)
      : apiAdminRepository.unlockShop(shopId, actor),
  getModerationProducts: () =>
    features.domains.adminMock()
      ? mockAdminRepository.getModerationProducts()
      : apiAdminRepository.getModerationProducts(),
  getModerationReviews: () => features.domains.adminMock() ? mockAdminRepository.getModerationReviews() : apiAdminRepository.getModerationReviews(),
  moderateReview: (id, status, reason) => features.domains.adminMock() ? mockAdminRepository.moderateReview(id, status, reason) : apiAdminRepository.moderateReview(id, status, reason),
  moderateProduct: (productId, status, reason, actor) =>
    features.domains.adminMock()
      ? mockAdminRepository.moderateProduct(productId, status, reason, actor)
      : apiAdminRepository.moderateProduct(productId, status, reason, actor),
  getAuditLogs: () =>
    features.domains.adminMock() ? mockAdminRepository.getAuditLogs() : apiAdminRepository.getAuditLogs(),
  getCategories: () =>
    features.domains.adminMock() ? mockAdminRepository.getCategories() : apiAdminRepository.getCategories(),
  getCategoryTree: () =>
    features.domains.adminMock() ? mockAdminRepository.getCategoryTree() : apiAdminRepository.getCategoryTree(),
  createCategory: (input) =>
    features.domains.adminMock() ? mockAdminRepository.createCategory(input) : apiAdminRepository.createCategory(input),
  updateCategory: (id, input) =>
    features.domains.adminMock() ? mockAdminRepository.updateCategory(id, input) : apiAdminRepository.updateCategory(id, input),
  toggleCategoryStatus: (id) =>
    features.domains.adminMock()
      ? mockAdminRepository.toggleCategoryStatus(id)
      : apiAdminRepository.toggleCategoryStatus(id),
};
