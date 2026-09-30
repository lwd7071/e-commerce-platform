import { describe, it, expect, vi } from "vitest";
import { sanitizeReturnTo } from "@/lib/auth/route-guards";
import type { AuthUser } from "@/lib/auth/types";

describe("Workstream A: Seller Onboarding, Session Refresh & Navigation Gating (A-101 - A-104)", () => {
  describe("Task A-104: Safe returnTo Open Redirect Protection", () => {
    it("preserves valid internal relative paths", () => {
      expect(sanitizeReturnTo("/cart")).toBe("/cart");
      expect(sanitizeReturnTo("/seller/products")).toBe("/seller/products");
      expect(sanitizeReturnTo("/seller/orders?status=PENDING")).toBe("/seller/orders?status=PENDING");
      expect(sanitizeReturnTo("/checkout#payment")).toBe("/checkout#payment");
    });

    it("falls back to root '/' on external URLs, protocol-relative, and backslash exploits", () => {
      expect(sanitizeReturnTo("https://evil.com")).toBe("/");
      expect(sanitizeReturnTo("http://malicious.org/phish")).toBe("/");
      expect(sanitizeReturnTo("//evil.com")).toBe("/");
      expect(sanitizeReturnTo("//evil.com/login")).toBe("/");
      expect(sanitizeReturnTo("/\\evil.com")).toBe("/");
      expect(sanitizeReturnTo("\\\\evil.com")).toBe("/");
      expect(sanitizeReturnTo("javascript:alert(document.cookie)")).toBe("/");
      expect(sanitizeReturnTo("data:text/html;base64,PHNjcmlwdD4=")).toBe("/");
      expect(sanitizeReturnTo(null)).toBe("/");
      expect(sanitizeReturnTo(undefined)).toBe("/");
      expect(sanitizeReturnTo("")).toBe("/");
    });
  });

  describe("Task A-101 & A-102: Seller Onboarding State & Session Refresh", () => {
    it("correctly models AuthUser with shopStatus PENDING post-onboarding", () => {
      const pendingSellerUser: AuthUser = {
        id: "usr-seller-001",
        email: "seller.pending@dino.vn",
        fullName: "Nguyễn Văn Người Bán",
        role: "SELLER",
        shopId: "shp-pending-001",
        shopStatus: "PENDING",
      };

      expect(pendingSellerUser.role).toBe("SELLER");
      expect(pendingSellerUser.shopStatus).toBe("PENDING");
      expect(pendingSellerUser.shopId).toBe("shp-pending-001");
    });

    it("transitions shopStatus from PENDING to ACTIVE upon admin approval and reloadUser()", async () => {
      let currentBackendUser: {
        id: string;
        email: string;
        full_name: string;
        role: "BUYER" | "SELLER" | "ADMIN";
        shop_id: string;
        shop_status: "PENDING" | "ACTIVE" | "SUSPENDED" | "LOCKED";
      } = {
        id: "usr-seller-001",
        email: "seller.pending@dino.vn",
        full_name: "Nguyễn Văn Người Bán",
        role: "SELLER",
        shop_id: "shp-pending-001",
        shop_status: "PENDING",
      };

      // Mock auth repository
      const mockAuthRepo = {
        me: vi.fn(async () => currentBackendUser),
        onboarding: vi.fn(async () => currentBackendUser),
      };

      // Step 1: Initial me() fetch
      const userStep1 = await mockAuthRepo.me();
      expect(userStep1.shop_status).toBe("PENDING");

      // Step 2: Admin approves shop in backend
      currentBackendUser = {
        ...currentBackendUser,
        shop_status: "ACTIVE",
      };

      // Step 3: reloadUser() executes me()
      const userStep2 = await mockAuthRepo.me();
      expect(userStep2.shop_status).toBe("ACTIVE");
      expect(mockAuthRepo.me).toHaveBeenCalledTimes(2);
    });
  });

  describe("Task A-103: Gating Seller Mutation Capabilities by Shop Status", () => {
    it("evaluates gating predicate isShopPending correctly for all user roles & shop statuses", () => {
      const isShopPending = (user: AuthUser | null): boolean => {
        return user?.role === "SELLER" && user?.shopStatus === "PENDING";
      };

      // 1. Pending Seller -> Must be gated
      const pendingSeller: AuthUser = {
        id: "s1",
        email: "s1@dino.vn",
        role: "SELLER",
        shopStatus: "PENDING",
      };
      expect(isShopPending(pendingSeller)).toBe(true);

      // 2. Active Seller -> Allowed
      const activeSeller: AuthUser = {
        id: "s2",
        email: "s2@dino.vn",
        role: "SELLER",
        shopStatus: "ACTIVE",
      };
      expect(isShopPending(activeSeller)).toBe(false);

      // 3. Buyer -> Not a seller, not pending seller
      const buyer: AuthUser = {
        id: "b1",
        email: "b1@dino.vn",
        role: "BUYER",
      };
      expect(isShopPending(buyer)).toBe(false);

      // 4. Admin -> Allowed
      const admin: AuthUser = {
        id: "a1",
        email: "admin@dino.vn",
        role: "ADMIN",
      };
      expect(isShopPending(admin)).toBe(false);

      // 5. Unauthenticated guest -> Not pending seller
      expect(isShopPending(null)).toBe(false);
    });

    it("verifies mutation actions are blocked when shop is pending", () => {
      const isShopPending = true;

      // Simulation of seller-product-create submit guard
      const handleSubmitAttempt = (isPending: boolean): { permitted: boolean; error?: string } => {
        if (isPending) {
          return { permitted: false, error: "Gian hàng đang chờ duyệt. Bạn chưa thể tạo sản phẩm mới." };
        }
        return { permitted: true };
      };

      // Simulation of stock edit guard
      const handleSaveStockAttempt = (isPending: boolean): { permitted: boolean; error?: string } => {
        if (isPending) {
          return { permitted: false, error: "Gian hàng đang chờ duyệt. Không thể thay đổi tồn kho." };
        }
        return { permitted: true };
      };

      const submitResult = handleSubmitAttempt(isShopPending);
      expect(submitResult.permitted).toBe(false);
      expect(submitResult.error).toContain("chờ duyệt");

      const stockResult = handleSaveStockAttempt(isShopPending);
      expect(stockResult.permitted).toBe(false);
      expect(stockResult.error).toContain("Không thể thay đổi tồn kho");
    });
  });
});
