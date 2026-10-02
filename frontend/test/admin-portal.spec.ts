import { describe, it, expect } from "vitest";
import { mockAdminRepository } from "../src/lib/repositories/repository-factory";

describe("Admin Moderation Portal (Người 5 - TDD)", () => {
  // This suite verifies fixture behavior explicitly; live mode must propagate HTTP failures.
  const adminRepo = mockAdminRepository;

  it("lấy danh sách người dùng đầy đủ với các role BUYER, SELLER, ADMIN", async () => {
    const users = await adminRepo.getUsers();
    expect(users).toBeDefined();
    expect(users.length).toBeGreaterThan(0);
    const roles = users.map((u) => u.role);
    expect(roles).toContain("BUYER");
    expect(roles).toContain("SELLER");
  });

  it("lọc danh sách người dùng theo trạng thái ACTIVE hoặc LOCKED", async () => {
    const lockedUsers = await adminRepo.getUsers({ status: "LOCKED" });
    expect(lockedUsers.every((u) => u.status === "LOCKED")).toBe(true);
  });

  it("chặn khóa tài khoản khi lý do (reason) bị để trống", async () => {
    await expect(
      adminRepo.lockUser({ user_id: "usr_001", reason: "   " })
    ).rejects.toThrow("lý do");
  });

  it("khóa tài khoản thành công khi có lý do hợp lệ và chuyển trạng thái thành LOCKED", async () => {
    await adminRepo.lockUser({ user_id: "usr_001", reason: "Vi phạm chính sách thanh toán" });
    const users = await adminRepo.getUsers();
    const updated = users.find((u) => u.id === "usr_001");
    expect(updated?.status).toBe("LOCKED");
  });

  it("mở khóa tài khoản thành công chuyển trạng thái về ACTIVE", async () => {
    await adminRepo.unlockUser("usr_001");
    const users = await adminRepo.getUsers();
    const updated = users.find((u) => u.id === "usr_001");
    expect(updated?.status).toBe("ACTIVE");
  });

  describe("Shop Moderation & Approval Flow", () => {
    it("lấy danh sách 20 shop ban đầu và xác nhận có các shop PENDING từ seed data", async () => {
      const shops = await adminRepo.getShops();
      expect(shops).toBeDefined();
      expect(shops.length).toBe(20);
      const pendingShops = shops.filter((s) => s.status === "PENDING");
      expect(pendingShops.length).toBeGreaterThan(0);
    });

    it("lọc danh sách shop theo trạng thái PENDING", async () => {
      const pendingShops = await adminRepo.getShops({ status: "PENDING" });
      expect(pendingShops.every((s) => s.status === "PENDING")).toBe(true);
    });

    it("duyệt shop PENDING thành công chuyển trạng thái thành ACTIVE", async () => {
      const targetShopId = "00000000-0000-0000-0000-000000000001";
      await adminRepo.approveShop(targetShopId);
      const shops = await adminRepo.getShops();
      const approved = shops.find((s) => s.shop_id === targetShopId);
      expect(approved?.status).toBe("ACTIVE");
    });

    it("chặn khóa shop khi lý do (reason) bị để trống", async () => {
      const targetShopId = "00000000-0000-0000-0000-000000000001";
      await expect(
        adminRepo.lockShop({ shop_id: targetShopId, reason: "   " })
      ).rejects.toThrow("lý do");
    });

    it("khóa shop thành công khi có lý do và chuyển trạng thái thành LOCKED", async () => {
      const targetShopId = "00000000-0000-0000-0000-000000000002";
      await adminRepo.lockShop({ shop_id: targetShopId, reason: "Hàng giả nhãn hiệu" });
      const shops = await adminRepo.getShops();
      const locked = shops.find((s) => s.shop_id === targetShopId);
      expect(locked?.status).toBe("LOCKED");
    });

    it("mở khóa shop chuyển trạng thái về ACTIVE", async () => {
      const targetShopId = "00000000-0000-0000-0000-000000000002";
      await adminRepo.unlockShop(targetShopId);
      const shops = await adminRepo.getShops();
      const unlocked = shops.find((s) => s.shop_id === targetShopId);
      expect(unlocked?.status).toBe("ACTIVE");
    });
  });
});

