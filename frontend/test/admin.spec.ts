import { describe, it, expect, beforeEach } from "vitest";
import { MockAdminRepository, resetMockAdminStore } from "@/features/admin/admin.repository";
import { matchRouteRule } from "@/lib/auth/route-guards";

describe("Cụm 4 - Admin & Seller Management (A-704, A-705, A-708, A-709, Q-805)", () => {
  let adminRepo: MockAdminRepository;

  beforeEach(() => {
    resetMockAdminStore();
    adminRepo = new MockAdminRepository();
  });

  describe("Rule QD19: Revenue Reporting Compliance (No Client-side Approximation)", () => {
    it("Admin Dashboard revenue only counts COMPLETED orders", async () => {
      const stats = await adminRepo.getDashboardStats();

      // Expected revenue: only completed orders
      // In inMemoryMockOrders, the only completed order is ORD-2026-0920-04 with final_amount 280000.00
      expect(Number(stats.platformGMV)).toBeGreaterThan(0);
      expect(stats.platformGMV).toBe("280000");
    });

    it("Seller KPI revenue strictly totals only COMPLETED orders for the shop", async () => {
      const kpi = await adminRepo.getSellerKPI("00000000-0000-0000-0000-000000000001");

      expect(kpi.shopId).toBe("00000000-0000-0000-0000-000000000001");
      expect(kpi.completedOrdersCount).toBe(1);
      expect(kpi.totalRevenue).toBe("280000");
      expect(kpi.averageRating).toBe(4.9);
    });
  });

  describe("User Moderation & Audit Logging (Ticket A-705 & RB-LTT08)", () => {
    it("locks a user account with mandatory reason and logs audit record", async () => {
      const user = await adminRepo.lockUser(
        "usr_002",
        "Spam liên tục trong đánh giá sản phẩm",
        "admin@dino.vn"
      );

      expect(user.status).toBe("LOCKED");
      expect(user.lockReason).toBe("Spam liên tục trong đánh giá sản phẩm");

      const logs = await adminRepo.getAuditLogs();
      const latestLog = logs[0];
      expect(latestLog.action).toBe("LOCK_USER");
      expect(latestLog.targetId).toBe("usr_002");
      expect(latestLog.reason).toBe("Spam liên tục trong đánh giá sản phẩm");
      expect(latestLog.actor).toBe("admin@dino.vn");
    });

    it("rejects locking a user if reason is missing or empty (RB-LTT08)", async () => {
      await expect(
        adminRepo.lockUser("usr_002", "", "admin@dino.vn")
      ).rejects.toThrow("Lý do khóa tài khoản là bắt buộc");

      await expect(
        adminRepo.lockUser("usr_002", "   ", "admin@dino.vn")
      ).rejects.toThrow("Lý do khóa tài khoản là bắt buộc");
    });

    it("prevents locking an administrator account", async () => {
      // usr_005 is system ADMIN
      await expect(
        adminRepo.lockUser("usr_005", "Thử nghiệm khóa admin", "admin@dino.vn")
      ).rejects.toThrow("Không thể khóa tài khoản quản trị viên");
    });

    it("unlocks a locked user and records audit log", async () => {
      // First lock
      await adminRepo.lockUser("usr_002", "Tạm khóa kiểm tra", "admin@dino.vn");
      // Then unlock
      const unlocked = await adminRepo.unlockUser("usr_002", "admin@dino.vn");

      expect(unlocked.status).toBe("ACTIVE");
      expect(unlocked.lockReason).toBeFalsy();

      const logs = await adminRepo.getAuditLogs();
      expect(logs[0].action).toBe("UNLOCK_USER");
      expect(logs[0].targetId).toBe("usr_002");
    });
  });

  describe("Shop & Product Moderation", () => {
    it("locks a shop with mandatory reason and logs audit record", async () => {
      const shop = await adminRepo.lockShop(
        "00000000-0000-0000-0000-000000000002",
        "Bán hàng giả không rõ xuất xứ",
        "admin@dino.vn"
      );

      expect(shop.status).toBe("LOCKED");
      expect(shop.lockReason).toBe("Bán hàng giả không rõ xuất xứ");

      const logs = await adminRepo.getAuditLogs();
      expect(logs[0].action).toBe("LOCK_SHOP");
    });

    it("moderates product visibility with audit trail", async () => {
      const hidden = await adminRepo.moderateProduct(
        "prod_mod_02",
        "HIDDEN",
        "Hình ảnh quảng cáo vi phạm thuần phong mỹ tục",
        "admin@dino.vn"
      );

      expect(hidden.status).toBe("HIDDEN");
      expect(hidden.reportReason).toContain("vi phạm");

      const logs = await adminRepo.getAuditLogs();
      expect(logs[0].action).toBe("HIDE_PRODUCT");
    });
  });

  describe("Categories Management & 2-Level Limit (Ticket A-709 & RB-KN04)", () => {
    it("allows creating a root category", async () => {
      const rootCat = await adminRepo.createCategory({
        name: "Thiết Bị Gia Dụng",
        parentId: null,
        description: "Đồ điện tử gia dụng gia đình",
      });

      expect(rootCat.name).toBe("Thiết Bị Gia Dụng");
      expect(rootCat.parentId).toBeNull();
      expect(rootCat.status).toBe("ACTIVE");
    });

    it("allows creating a subcategory under a verified root category", async () => {
      const subCat = await adminRepo.createCategory({
        name: "Kem dưỡng ẩm",
        parentId: "00000000-0000-0000-0000-000000000010",
        description: "Các loại kem dưỡng ẩm sâu",
      });

      expect(subCat.name).toBe("Kem dưỡng ẩm");
      expect(subCat.parentId).toBe("00000000-0000-0000-0000-000000000010");
    });

    it("strictly rejects creating a 3rd-level subcategory per RB-KN04", async () => {
      // 00000000-0000-0000-0000-000000000110 is already a child of 00000000-0000-0000-0000-000000000010
      await expect(
        adminRepo.createCategory({
          name: "Cáp sạc Type-C nhanh",
          parentId: "00000000-0000-0000-0000-000000000110",
        })
      ).rejects.toThrow("Quy tắc RB-KN04: Danh mục chỉ được hỗ trợ tối đa 2 cấp phân cấp");
    });

    it("prevents deleting a parent category that still has subcategories", async () => {
      await expect(
        adminRepo.deleteCategory("00000000-0000-0000-0000-000000000010")
      ).rejects.toThrow("Không thể xóa danh mục cha đang chứa các danh mục con");
    });

    it("toggles category status between ACTIVE and INACTIVE", async () => {
      const updated = await adminRepo.toggleCategoryStatus("00000000-0000-0000-0000-000000000110");
      expect(updated.status).toBe("INACTIVE");

      const reverted = await adminRepo.toggleCategoryStatus("00000000-0000-0000-0000-000000000110");
      expect(reverted.status).toBe("ACTIVE");
    });

    it("builds a clean 2-level category tree", async () => {
      const tree = await adminRepo.getCategoryTree();
      expect(tree.length).toBeGreaterThan(0);

      // Verify each root has parentId null and children with matching parentId
      for (const root of tree) {
        expect(root.parentId).toBeNull();
        for (const child of root.children) {
          expect(child.parentId).toBe(root.id);
        }
      }
    });
  });

  describe("Security Gate & Route Rules (Ticket Q-805)", () => {
    it("restricts /admin routes to ADMIN role only", () => {
      const adminRule = matchRouteRule("/admin");
      expect(adminRule?.requireAuth).toBe(true);
      expect(adminRule?.allowedRoles).toEqual(["ADMIN"]);

      const adminCatRule = matchRouteRule("/admin/categories");
      expect(adminCatRule?.requireAuth).toBe(true);
      expect(adminCatRule?.allowedRoles).toEqual(["ADMIN"]);
    });

    it("restricts /seller routes to SELLER and ADMIN roles", () => {
      const sellerRule = matchRouteRule("/seller");
      expect(sellerRule?.requireAuth).toBe(true);
      expect(sellerRule?.allowedRoles).toContain("SELLER");
      expect(sellerRule?.allowedRoles).toContain("ADMIN");

      const sellerOrdersRule = matchRouteRule("/seller/orders");
      expect(sellerOrdersRule?.requireAuth).toBe(true);
      expect(sellerOrdersRule?.allowedRoles).toContain("SELLER");
    });
  });
});
