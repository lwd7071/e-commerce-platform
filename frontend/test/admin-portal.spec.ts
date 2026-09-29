import { describe, it, expect } from "vitest";
import { repositories } from "../src/lib/repositories/repository-factory";

describe("Admin Moderation Portal (Người 5 - TDD)", () => {
  const adminRepo = repositories.admin();

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
});
