import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiAdminRepository } from "@/features/admin/admin.repository";
import { apiClient } from "@/lib/api/client";

describe("ADMIN-03 & ADMIN-04: Users & Shops Detail & Cursor Pagination (FE Unit)", () => {
  let repo: ApiAdminRepository;

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new ApiAdminRepository();
  });

  it("getUserDetail fetches user details by ID", async () => {
    const mockUser = {
      id: "u123",
      email: "buyer@example.com",
      full_name: "Nguyễn Văn Test",
      fullName: "Nguyễn Văn Test",
      role: "BUYER",
      status: "ACTIVE",
      created_at: "2026-01-01T00:00:00Z",
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockUser);

    const user = await repo.getUserDetail("u123");

    expect(apiClient.get).toHaveBeenCalledWith("/admin/users/u123");
    expect(user.id).toBe("u123");
    expect(user.email).toBe("buyer@example.com");
    expect(user.fullName).toBe("Nguyễn Văn Test");
  });

  it("getShopDetail fetches shop details including contact and pickup address", async () => {
    const mockShop = {
      id: "s123",
      name: "Shop Demo",
      shop_name: "Shop Demo",
      ownerId: "u123",
      ownerEmail: "owner@example.com",
      productCount: 15,
      contactPhone: "0909876543",
      pickupAddress: "456 Le Loi, Q1, HCMC",
      description: "Gian hàng chính hãng",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00Z",
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce(mockShop);

    const shop = await repo.getShopDetail("s123");

    expect(apiClient.get).toHaveBeenCalledWith("/admin/shops/s123");
    expect(shop.id).toBe("s123");
    expect(shop.name).toBe("Shop Demo");
    expect(shop.contactPhone).toBe("0909876543");
    expect(shop.pickupAddress).toBe("456 Le Loi, Q1, HCMC");
  });

  it("getUsersPage requests paginated envelope with cursor and limit", async () => {
    const mockEnvelope = {
      data: [
        {
          id: "u1",
          email: "u1@example.com",
          full_name: "User 1",
          role: "BUYER" as const,
          status: "ACTIVE" as const,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: {
        next_cursor: "next_user_cursor",
        has_more: true,
        limit: 10,
      },
      request_id: "req_test",
    };

    vi.spyOn(apiClient, "getPaginated").mockResolvedValueOnce(mockEnvelope);

    const page = await repo.getUsersPage({ limit: 10, cursor: "curr_cursor" });

    expect(apiClient.getPaginated).toHaveBeenCalledWith("/admin/users", {
      params: { limit: 10, cursor: "curr_cursor" },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].email).toBe("u1@example.com");
    expect(page.next_cursor).toBe("next_user_cursor");
    expect(page.has_more).toBe(true);
  });

  it("getShopsPage requests paginated envelope with cursor and limit", async () => {
    const mockEnvelope = {
      data: [
        {
          shop_id: "s1",
          shop_name: "Shop 1",
          owner_email: "s1@example.com",
          product_count: 5,
          status: "ACTIVE" as const,
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: {
        next_cursor: "next_shop_cursor",
        has_more: true,
        limit: 10,
      },
      request_id: "req_test",
    };

    vi.spyOn(apiClient, "getPaginated").mockResolvedValueOnce(mockEnvelope);

    const page = await repo.getShopsPage({ limit: 10, cursor: "curr_cursor" });

    expect(apiClient.getPaginated).toHaveBeenCalledWith("/admin/shops", {
      params: { limit: 10, cursor: "curr_cursor" },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe("Shop 1");
    expect(page.next_cursor).toBe("next_shop_cursor");
    expect(page.has_more).toBe(true);
  });
});
