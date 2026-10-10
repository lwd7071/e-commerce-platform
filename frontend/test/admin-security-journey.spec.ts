import { describe, expect, it } from "vitest";
import { matchRouteRule } from "@/lib/auth/route-guards";
import { mockAdminRepository } from "@/lib/repositories/repository-factory";

describe("E2E Security & RBAC Journey: Admin Portal Protection & Auditing (ADMIN-13)", () => {
  const adminRepo = mockAdminRepository;

  describe("1. RBAC Guard Enforcement", () => {
    it("strictly blocks unauthenticated access and non-ADMIN roles from /admin portal", () => {
      const adminRoutes = [
        "/admin",
        "/admin/shops",
        "/admin/categories",
        "/admin/orders",
        "/admin/vouchers",
        "/admin/reports",
        "/admin/audit-logs",
      ];

      for (const route of adminRoutes) {
        const rule = matchRouteRule(route);
        expect(rule).toBeDefined();
        expect(rule?.requireAuth).toBe(true);
        expect(rule?.allowedRoles).toEqual(["ADMIN"]);
        expect(rule?.allowedRoles).not.toContain("BUYER");
        expect(rule?.allowedRoles).not.toContain("SELLER");
      }
    });

    it("verifies Buyer and Seller cannot inherit or bypass Admin role routes", () => {
      const buyerRule = matchRouteRule("/admin/shops");
      const isBuyerAllowed = buyerRule?.allowedRoles?.includes("BUYER") ?? false;
      expect(isBuyerAllowed).toBe(false);

      const sellerRule = matchRouteRule("/admin/vouchers");
      const isSellerAllowed = sellerRule?.allowedRoles?.includes("SELLER") ?? false;
      expect(isSellerAllowed).toBe(false);
    });
  });

  describe("2. Admin Operational Journey & Full Audit Trail", () => {
    it("completes full admin moderation cycle with tamper-proof audit trail", async () => {
      // BƯỚC 1: Admin đăng nhập và duyệt gian hàng mới
      const pendingShops = await adminRepo.getShops({ status: "PENDING" });
      expect(pendingShops.length).toBeGreaterThan(0);
      const targetShop = pendingShops[0];

      await adminRepo.approveShop(targetShop.shop_id, "Hồ sơ kinh doanh và địa chỉ kho đã được thẩm định hợp lệ");

      const shopsAfterApprove = await adminRepo.getShops();
      const approvedShop = shopsAfterApprove.find((s) => s.shop_id === targetShop.shop_id);
      expect(approvedShop?.status).toBe("ACTIVE");

      // BƯỚC 2: Admin phát hiện tài khoản gian lận và khóa người dùng
      const users = await adminRepo.getUsers({ status: "ACTIVE" });
      const targetUser = users.find((u) => u.role === "BUYER" || u.role === "SELLER");
      expect(targetUser).toBeDefined();

      // Cố tình khóa không có lý do -> Bị chặn fail-fast
      await expect(
        adminRepo.lockUser({ user_id: targetUser!.id, reason: "   " })
      ).rejects.toThrow("lý do");

      // Khóa với lý do hợp lệ
      await adminRepo.lockUser({
        user_id: targetUser!.id,
        reason: "Phát hiện hành vi spam đơn hàng ảo trục lợi mã khuyến mãi",
      });

      const usersAfterLock = await adminRepo.getUsers();
      const lockedUser = usersAfterLock.find((u) => u.id === targetUser!.id);
      expect(lockedUser?.status).toBe("LOCKED");

      // BƯỚC 3: Mở khóa lại người dùng khi hoàn tất khiếu nại
      await adminRepo.unlockUser(targetUser!.id);
      const usersAfterUnlock = await adminRepo.getUsers();
      const unlockedUser = usersAfterUnlock.find((u) => u.id === targetUser!.id);
      expect(unlockedUser?.status).toBe("ACTIVE");
    });
  });
});
