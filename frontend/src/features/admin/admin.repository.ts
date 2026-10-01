import { apiClient } from "@/lib/api/client";
import { features } from "@/lib/config/features";
import { DEV_CATEGORY_FIXTURES, type CategoryItem, type CategoryTreeNode } from "@/lib/adapters/category.adapter";
import {
  mockOrderRepository,
} from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
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
  lockUser(userId: string, reason: string, actor?: string): Promise<UserAccount>;
  unlockUser(userId: string, actor?: string): Promise<UserAccount>;
  getShops(): Promise<PlatformShop[]>;
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

// Initial mock data store
const initialUsers: UserAccount[] = [
  {
    id: "usr_001",
    email: "buyer1@example.com",
    fullName: "Nguyễn Văn A",
    role: "BUYER",
    status: "ACTIVE",
    createdAt: "2026-01-10T08:00:00Z",
  },
  {
    id: "usr_002",
    email: "seller1@dino.vn",
    fullName: "Dino Beauty Store",
    role: "SELLER",
    status: "ACTIVE",
    createdAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "usr_003",
    email: "spambot99@fake.net",
    fullName: "Spam Bot Account",
    role: "BUYER",
    status: "LOCKED",
    lockReason: "Spam bình luận và đặt đơn hàng ảo liên tục",
    createdAt: "2026-02-12T14:20:00Z",
  },
  {
    id: "usr_004",
    email: "seller2@dino.vn",
    fullName: "Dino Tech Official",
    role: "SELLER",
    status: "ACTIVE",
    createdAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "usr_005",
    email: "admin@dino.vn",
    fullName: "Quản trị viên Hệ thống",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
  },
];

const initialShops: PlatformShop[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Dino Beauty Official",
    ownerEmail: "seller1@dino.vn",
    productCount: 18,
    status: "ACTIVE",
    createdAt: "2026-01-15T09:30:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Dino Tech Store",
    ownerEmail: "seller2@dino.vn",
    productCount: 24,
    status: "ACTIVE",
    createdAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Cửa Hàng Hàng Giả Kém Chất Lượng",
    ownerEmail: "fakevendor@bad.com",
    productCount: 3,
    status: "LOCKED",
    lockReason: "Bán hàng nhái, vi phạm quyền sở hữu trí tuệ",
    createdAt: "2026-03-01T11:00:00Z",
  },
];

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

const initialAuditLogs: AdminAuditLog[] = [
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

// In-memory persistent stores
let mockUsers = [...initialUsers];
let mockShops = [...initialShops];
let mockProducts = [...initialModerationProducts];
let mockAuditLogs = [...initialAuditLogs];

// Local categories store for admin CRUD (A-709)
let localCategories: CategoryItem[] = DEV_CATEGORY_FIXTURES.map((c) => ({ ...c }));

export function resetMockAdminStore() {
  mockUsers = [...initialUsers];
  mockShops = [...initialShops];
  mockProducts = [...initialModerationProducts];
  mockAuditLogs = [...initialAuditLogs];
  localCategories = DEV_CATEGORY_FIXTURES.map((c) => ({ ...c }));
}

export class MockAdminRepository implements IAdminRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const orders = await mockOrderRepository.getOrders();
    // Rule QD19: Only COMPLETED orders contribute to platform GMV
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const totalGMV = completedOrders.reduce((sum, o) => {
      return sum + moneyAdapter.toInteger(o.total_amount);
    }, 0);

    return {
      totalUsers: mockUsers.length,
      totalShops: mockShops.length,
      totalProducts: mockProducts.length,
      platformGMV: totalGMV.toString(),
    };
  }

  async getUsers(): Promise<UserAccount[]> {
    return [...mockUsers];
  }

  async lockUser(userId: string, reason: string, actor = "admin@dino.vn"): Promise<UserAccount> {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Lý do khóa tài khoản là bắt buộc.");
    }
    const found = mockUsers.find((u) => u.id === userId);
    if (!found) throw new Error("Không tìm thấy người dùng.");

    if (found.role === "ADMIN") {
      throw new Error("Không thể khóa tài khoản quản trị viên tối cao.");
    }

    found.status = "LOCKED";
    found.lockReason = reason.trim();

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "LOCK_USER",
      targetType: "USER",
      targetId: found.id,
      targetName: found.fullName || found.email,
      reason: reason.trim(),
      actor,
      createdAt: new Date().toISOString(),
    });

    return { ...found };
  }

  async unlockUser(userId: string, actor = "admin@dino.vn"): Promise<UserAccount> {
    const found = mockUsers.find((u) => u.id === userId);
    if (!found) throw new Error("Không tìm thấy người dùng.");

    found.status = "ACTIVE";
    found.lockReason = null;

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "UNLOCK_USER",
      targetType: "USER",
      targetId: found.id,
      targetName: found.fullName || found.email,
      reason: "Mở khóa tài khoản người dùng sau kiểm tra",
      actor,
      createdAt: new Date().toISOString(),
    });

    return { ...found };
  }

  async getShops(): Promise<PlatformShop[]> {
    return [...mockShops];
  }

  async lockShop(shopId: string, reason: string, actor = "admin@dino.vn"): Promise<PlatformShop> {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Lý do khóa gian hàng là bắt buộc.");
    }
    const found = mockShops.find((s) => s.id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");

    found.status = "LOCKED";
    found.lockReason = reason.trim();

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "LOCK_SHOP",
      targetType: "SHOP",
      targetId: found.id,
      targetName: found.name,
      reason: reason.trim(),
      actor,
      createdAt: new Date().toISOString(),
    });

    return { ...found };
  }

  async unlockShop(shopId: string, actor = "admin@dino.vn"): Promise<PlatformShop> {
    const found = mockShops.find((s) => s.id === shopId);
    if (!found) throw new Error("Không tìm thấy gian hàng.");

    found.status = "ACTIVE";
    found.lockReason = null;

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "UNLOCK_SHOP",
      targetType: "SHOP",
      targetId: found.id,
      targetName: found.name,
      reason: "Mở khóa gian hàng sau khi hoàn tất xác minh",
      actor,
      createdAt: new Date().toISOString(),
    });

    return { ...found };
  }

  async getModerationProducts(): Promise<ModerationProduct[]> {
    return [...mockProducts];
  }

  async getModerationReviews(): Promise<ModerationReview[]> { return []; }

  async moderateReview(reviewId: string, status: "VISIBLE" | "HIDDEN", reason: string): Promise<ModerationReview> {
    void reviewId; void status; void reason;
    throw new Error("Review moderation is unavailable in fixture mode.");
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
    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: status === "HIDDEN" ? "HIDE_PRODUCT" : "RESTORE_PRODUCT",
      targetType: "PRODUCT",
      targetId: found.id,
      targetName: found.name,
      reason: reason || (status === "HIDDEN" ? "Ẩn sản phẩm do vi phạm" : "Khôi phục hiển thị sản phẩm"),
      actor,
      createdAt: new Date().toISOString(),
    });

    return { ...found };
  }

  async getAuditLogs(): Promise<AdminAuditLog[]> {
    return [...mockAuditLogs];
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

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "CREATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: newCat.id,
      targetName: newCat.name,
      reason: "Thêm danh mục mới vào hệ sinh thái sàn",
      actor: "admin@dino.vn",
      createdAt: new Date().toISOString(),
    });

    return newCat;
  }

  async toggleCategoryStatus(id: string): Promise<CategoryItem> {
    const cats = await this.getCategories();
    const found = cats.find((c) => c.id === id);
    if (!found) throw new Error("Không tìm thấy danh mục.");

    found.status = found.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "UPDATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: found.id,
      targetName: found.name,
      reason: `Đổi trạng thái danh mục sang ${found.status}`,
      actor: "admin@dino.vn",
      createdAt: new Date().toISOString(),
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

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "UPDATE_CATEGORY",
      targetType: "CATEGORY",
      targetId: found.id,
      targetName: found.name,
      reason: "Cập nhật danh mục",
      actor: "admin@dino.vn",
      createdAt: new Date().toISOString(),
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
