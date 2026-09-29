import { features } from "@/lib/config/features";
import { categoryAdapter, type CategoryItem, type CategoryTreeNode } from "@/lib/adapters/category.adapter";
import { repositories } from "@/lib/repositories/repository-factory";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type {
  UserAccount,
  PlatformShop,
  ModerationProduct,
  AdminAuditLog,
  DashboardStats,
  SellerKPIStats,
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
  moderateProduct(
    productId: string,
    status: "ACTIVE" | "HIDDEN",
    reason?: string,
    actor?: string
  ): Promise<ModerationProduct>;
  getAuditLogs(): Promise<AdminAuditLog[]>;
  getSellerKPI(shopId?: string): Promise<SellerKPIStats>;

  // Category management (A-709)
  getCategories(): Promise<CategoryItem[]>;
  getCategoryTree(): Promise<CategoryTreeNode[]>;
  createCategory(input: {
    name: string;
    parentId?: string | null;
    description?: string | null;
  }): Promise<CategoryItem>;
  toggleCategoryStatus(id: string): Promise<CategoryItem>;
  deleteCategory(id: string): Promise<boolean>;
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
    reports: 0,
  },
  {
    id: "prod_mod_02",
    name: "Bàn Phím Cơ Không Dây 3 Chế Độ RGB",
    shopName: "Dino Tech Store",
    price: "850000.00",
    status: "ACTIVE",
    reports: 0,
  },
  {
    id: "prod_mod_03",
    name: "Nước hoa nhái thương hiệu cao cấp",
    shopName: "Cửa Hàng Hàng Giả Kém Chất Lượng",
    price: "99000.00",
    status: "HIDDEN",
    reports: 12,
    reportReason: "Hàng giả nhái thương hiệu quốc tế",
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
let localCategories: CategoryItem[] = [];

export class MockAdminRepository implements IAdminRepository {
  async getDashboardStats(): Promise<DashboardStats> {
    const orders = await repositories.order().getOrders();
    // Rule QD19: Only COMPLETED orders contribute to platform GMV
    const completedOrders = orders.filter((o) => o.status === "COMPLETED");
    const totalGMV = completedOrders.reduce((sum, o) => {
      return sum + moneyAdapter.toInteger(o.final_amount || o.total_amount);
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

  async moderateProduct(
    productId: string,
    status: "ACTIVE" | "HIDDEN",
    reason?: string,
    actor = "admin@dino.vn"
  ): Promise<ModerationProduct> {
    const found = mockProducts.find((p) => p.id === productId);
    if (!found) throw new Error("Không tìm thấy sản phẩm.");

    found.status = status;
    if (status === "HIDDEN" && reason) {
      found.reportReason = reason;
    }

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

  async getSellerKPI(shopId = "00000000-0000-0000-0000-000000000001"): Promise<SellerKPIStats> {
    const allOrders = await repositories.order().getOrders({ shop_id: shopId });

    // Rule QD19: Only COMPLETED orders count into revenue
    const completedOrders = allOrders.filter((o) => o.status === "COMPLETED");
    const totalRevInt = completedOrders.reduce((acc, o) => {
      return acc + moneyAdapter.toInteger(o.final_amount || o.total_amount);
    }, 0);

    const pendingOrders = allOrders.filter((o) => o.status === "PENDING_CONFIRMATION");
    let activeProductsCount = 18;
    try {
      const catalogProducts = await repositories.catalog().getProducts();
      const shopProducts = catalogProducts.filter((p) => p.shop_id === shopId);
      if (shopProducts.length > 0) {
        activeProductsCount = shopProducts.length;
      }
    } catch {
      // Fallback in case catalog API is offline or in mock tests
      activeProductsCount = 18;
    }

    return {
      shopId,
      shopName: shopId === "00000000-0000-0000-0000-000000000002" ? "Dino Tech Store" : "Dino Beauty Official",
      totalRevenue: totalRevInt.toString(),
      completedOrdersCount: completedOrders.length,
      pendingOrdersCount: pendingOrders.length,
      activeProductsCount,
      averageRating: 4.9,
    };
  }

  // Categories CRUD (A-709 consuming A-700 adapter)
  async getCategories(): Promise<CategoryItem[]> {
    if (localCategories.length === 0) {
      const adapterCats = await categoryAdapter.getCategories();
      localCategories = [...adapterCats];
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

  async deleteCategory(id: string): Promise<boolean> {
    const cats = await this.getCategories();
    const found = cats.find((c) => c.id === id);
    if (!found) throw new Error("Không tìm thấy danh mục.");

    // If it's a parent category with children, delete children or disallow
    const children = cats.filter((c) => c.parentId === id);
    if (children.length > 0) {
      throw new Error("Không thể xóa danh mục cha đang chứa các danh mục con.");
    }

    localCategories = localCategories.filter((c) => c.id !== id);

    mockAuditLogs.unshift({
      id: `log_${Date.now()}`,
      action: "DELETE_CATEGORY",
      targetType: "CATEGORY",
      targetId: id,
      targetName: found.name,
      reason: "Xóa danh mục khỏi hệ thống",
      actor: "admin@dino.vn",
      createdAt: new Date().toISOString(),
    });

    return true;
  }
}

export const adminRepository: IAdminRepository = new MockAdminRepository();
