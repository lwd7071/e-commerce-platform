// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerDashboardScreen } from "@/features/seller/seller-dashboard-screen";
import { sellerShopApi } from "@/lib/api/seller-shop.api";

const { mockGetKpi, mockGetOrders, mockGetProducts, mockUser } = vi.hoisted(() => ({
  mockGetKpi: vi.fn(),
  mockGetOrders: vi.fn(),
  mockGetProducts: vi.fn(),
  mockUser: { current: { role: "SELLER", shopStatus: "PENDING" } as Record<string, string> | null },
}));

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ user: mockUser.current }) }));
vi.mock("@/components/navigation/protected-page", () => ({ ProtectedPage: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/lib/repositories/repository-factory", () => ({
  repositories: {
    seller: () => ({ getKpi: mockGetKpi }),
    order: () => ({ getOrders: mockGetOrders }),
    catalog: () => ({ getSellerProducts: mockGetProducts }),
  },
}));
vi.mock("@/lib/api/seller-shop.api", () => ({
  sellerShopApi: { get: vi.fn() },
}));

describe("SellerDashboardScreen shop profile reminder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.current = { role: "SELLER", shopStatus: "PENDING" };
    mockGetKpi.mockResolvedValue({
      shopId: "shop-1", shopName: "Dino Store", totalRevenue: "0", completedOrdersCount: 0,
      pendingOrdersCount: 0, activeProductsCount: 0, averageRating: 0,
    });
    mockGetOrders.mockResolvedValue([]);
    mockGetProducts.mockResolvedValue([]);
  });

  it("tells pending sellers to add missing shop phone and pickup address", async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce({
      shop_id: "shop-1", shop_name: "Dino Store", description: null, pickup_address: " ",
      contact_phone: null, status: "PENDING", updated_at: "2026-10-01T00:00:00.000Z",
    });

    render(<SellerDashboardScreen />);

    expect(await screen.findByText(/địa chỉ lấy hàng và số điện thoại liên hệ/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Bổ sung thông tin" }).getAttribute("href")).toBe("/seller/shop");
  });

  it("names only the missing field when the other shop contact field is complete", async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce({
      shop_id: "shop-1", shop_name: "Dino Store", description: null, pickup_address: null,
      contact_phone: "0901234567", status: "PENDING", updated_at: "2026-10-01T00:00:00.000Z",
    });

    render(<SellerDashboardScreen />);

    expect(await screen.findByText(/địa chỉ lấy hàng trong hồ sơ gian hàng/)).toBeTruthy();
    expect(screen.queryByText(/số điện thoại liên hệ trong hồ sơ gian hàng/)).toBeNull();
    expect(screen.getByRole("link", { name: "Bổ sung thông tin" }).getAttribute("href")).toBe("/seller/shop");
  });

  it("does not show the completion reminder when both shop fields are present", async () => {
    vi.mocked(sellerShopApi.get).mockResolvedValueOnce({
      shop_id: "shop-1", shop_name: "Dino Store", description: null, pickup_address: "123 Đường A",
      contact_phone: "0901234567", status: "PENDING", updated_at: "2026-10-01T00:00:00.000Z",
    });

    render(<SellerDashboardScreen />);

    expect(await screen.findByTestId("shop-pending-banner")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Bổ sung thông tin" })).toBeNull();
  });

  it("does not fetch or show the completion reminder after shop approval", async () => {
    mockUser.current = { role: "SELLER", shopStatus: "ACTIVE" };

    render(<SellerDashboardScreen />);

    await screen.findByText("Dino Store");
    expect(sellerShopApi.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("shop-pending-banner")).toBeNull();
    expect(screen.queryByRole("link", { name: "Bổ sung thông tin" })).toBeNull();
  });

  it("shows the average rating with one decimal place", async () => {
    mockGetKpi.mockResolvedValueOnce({
      shopId: "shop-1", shopName: "Dino Store", totalRevenue: "0", completedOrdersCount: 0,
      pendingOrdersCount: 0, activeProductsCount: 0, averageRating: 3.6666666667,
    });
    mockUser.current = { role: "SELLER", shopStatus: "ACTIVE" };

    render(<SellerDashboardScreen />);

    expect(await screen.findByText("3.7")).toBeTruthy();
    expect(screen.getByText("/ 5.0 sao")).toBeTruthy();
    expect(screen.queryByText(/3\.666/)).toBeNull();
  });
});
