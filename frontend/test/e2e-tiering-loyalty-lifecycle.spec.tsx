// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";

// Mock feature flags to route all domain repositories to mock implementations
vi.mock("@/lib/config/features", () => ({
  features: {
    isProduction: () => false,
    useMock: () => true,
    isDebugEnabled: () => false,
    domains: {
      catalogLive: () => false,
      cartMock: () => true,
      checkoutMock: () => true,
      ordersMock: () => true,
      adminMock: () => true,
    },
  },
}));

import { repositories } from "@/lib/repositories/repository-factory";
import { ProductCard } from "@/features/catalog/product-card";
import { ProductDetailScreen } from "@/features/catalog/product-detail-screen";
import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import { BuyerLoyaltyCard } from "@/features/profile/loyalty-card";
import { buyerApi } from "@/lib/api/buyer.api";
import type { WireCatalogProductItem, WireCatalogProductDetail } from "@/lib/api/catalog.api";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const cleanProps = { ...props };
    delete cleanProps.fill;
    delete cleanProps.priority;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} {...cleanProps} />
    );
  },
}));

// Mock auth context for Buyer
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "buyer_test_01", email: "buyer@test.vn", role: "BUYER" },
    isAuthenticated: true,
  }),
}));

// Mock buyerApi
vi.mock("@/lib/api/buyer.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/buyer.api")>();
  return {
    ...actual,
    buyerApi: {
      ...actual.buyerApi,
      getLoyalty: vi.fn(),
      getLoyaltyHistory: vi.fn(),
    },
  };
});

describe("E2E Lifecycle: Tiering & Loyalty (Yêu cầu 3 & 4)", () => {
  const adminRepo = repositories.admin();
  const orderRepo = repositories.order();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Hành trình 1: Admin đổi hạng -> Catalog hiển thị Badge ở cả Card & Detail
  //              và bộ lọc Catalog theo phân hạng
  // =========================================================================
  describe("Hành trình 1: Admin đổi hạng Shop -> Catalog hiển thị Badge & Bộ lọc", () => {
    const shopId = "00000000-0000-0000-0000-000000000001";

    it("Admin cập nhật shop thành MALL -> ProductCard hiển thị Mall badge", async () => {
      expect(adminRepo.updateShopTier).toBeDefined();

      // 1. Admin cập nhật hạng gian hàng thành MALL với lý do bắt buộc
      await adminRepo.updateShopTier!(shopId, "MALL", "Thẩm định hồ sơ chính hãng hợp lệ");

      // 2. Sản phẩm thuộc shop MALL
      const mallProduct: WireCatalogProductItem = {
        product_id: "prod-mall-001",
        product_name: "Kem Chống Nắng Phổ Rộng SPF50+",
        shop_id: shopId,
        shop_tier: "MALL",
        category_id: "cat-beauty-01",
        min_price: "350000.00",
        max_price: "350000.00",
        total_stock: 120,
        image_url: "https://example.com/sunscreen.jpg",
        created_at: new Date().toISOString(),
      };

      // 3. Render ProductCard và kiểm tra badge Mall xuất hiện
      render(<ProductCard product={mallProduct} categoryName="Làm Đẹp" />);
      const badge = screen.getByText("Mall");
      expect(badge).toBeTruthy();
      expect(badge.className).toContain("tier-badge--mall");
    });

    it("Admin cập nhật shop thành PREFERRED -> ProductCard hiển thị Yêu thích badge", async () => {
      await adminRepo.updateShopTier!(shopId, "PREFERRED", "Shop đạt chuẩn đánh giá tích cực");

      const preferredProduct: WireCatalogProductItem = {
        product_id: "prod-pref-002",
        product_name: "Áo Thun Unisex Cotton 100%",
        shop_id: shopId,
        shop_tier: "PREFERRED",
        category_id: "cat-fashion-01",
        min_price: "150000.00",
        max_price: "190000.00",
        total_stock: 50,
        image_url: "https://example.com/tshirt.jpg",
        created_at: new Date().toISOString(),
      };

      render(<ProductCard product={preferredProduct} />);
      const badge = screen.getByText("Yêu thích");
      expect(badge).toBeTruthy();
      expect(badge.className).toContain("tier-badge--preferred");
    });

    it("ProductCard với shop STANDARD không hiển thị tier badge", () => {
      const standardProduct: WireCatalogProductItem = {
        product_id: "prod-std-003",
        product_name: "Cốc Sứ Bát Tràng Men Mát",
        shop_id: shopId,
        shop_tier: "STANDARD",
        category_id: "cat-home-01",
        min_price: "45000.00",
        max_price: "45000.00",
        total_stock: 200,
        image_url: "https://example.com/cup.jpg",
        created_at: new Date().toISOString(),
      };

      render(<ProductCard product={standardProduct} />);
      expect(screen.queryByText("Mall")).toBeNull();
      expect(screen.queryByText("Yêu thích")).toBeNull();
    });

    it("ProductDetail hiển thị TierBadge tương ứng với phân hạng của shop", async () => {
      const detailProduct: WireCatalogProductDetail = {
        product_id: "prod-mall-detail",
        product_name: "Serum Vitamin C Nguyên Chất 15%",
        description: "Serum sáng da mờ thâm cao cấp.",
        shop_id: shopId,
        shop_tier: "MALL",
        status: "ACTIVE",
        category_id: "cat-beauty-01",
        images: [{ image_id: "img-01", image_url: "https://example.com/serum1.jpg", sort_order: 1 }],
        variants: [
          {
            variant_id: "var-01",
            variant_name: "Dung tích",
            variant_value: "Chai 30ml",
            price: "499000.00",
            stock_quantity: 45,
            sku: "SERUM-VC-30ML",
            status: "ACTIVE",
          },
        ],
      };

      vi.spyOn(repositories.catalog(), "getProductById").mockResolvedValue(detailProduct);
      vi.spyOn(repositories.review(), "getReviewsByProduct").mockResolvedValue([]);

      const { ToastProvider } = await import("@/components/ui/toast");
      render(
        <ToastProvider>
          <ProductDetailScreen productId="prod-mall-detail" />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Serum Vitamin C Nguyên Chất 15%/i })).toBeTruthy();
      });

      // Kiểm tra TierBadge xuất hiện trên trang chi tiết sản phẩm
      const mallBadge = screen.getByText("Mall");
      expect(mallBadge).toBeTruthy();
      expect(mallBadge.className).toContain("tier-badge--mall");
    });

    it("CatalogListScreen có UI bộ lọc theo phân hạng shop và tương tác cập nhật truy vấn", async () => {
      render(<CatalogListScreen />);

      // Xác nhận các nút chip lọc phân hạng có mặt trên giao diện
      expect(screen.getByText("Tất cả shop")).toBeTruthy();
      const mallFilterBtn = screen.getByText("Dino Mall");
      const preferredFilterBtn = screen.getByText("Shop Yêu thích");
      expect(mallFilterBtn).toBeTruthy();
      expect(preferredFilterBtn).toBeTruthy();

      // Click vào bộ lọc "Dino Mall"
      await userEvent.click(mallFilterBtn);

      // Xác minh nút "Dino Mall" nhận trạng thái kích hoạt (badge active)
      await waitFor(() => {
        expect(mallFilterBtn.className).toContain("bg-[var(--danger)]");
        expect(window.location.search).toContain("shop_tier=MALL");
      });

      // Click vào bộ lọc "Shop Yêu thích"
      await userEvent.click(preferredFilterBtn);
      await waitFor(() => {
        expect(preferredFilterBtn.className).toContain("bg-amber-600");
        expect(window.location.search).toContain("shop_tier=PREFERRED");
      });
    });
  });

  // =========================================================================
  // Hành trình 2: Buyer nhận hàng -> Profile cập nhật điểm / hạng / lịch sử
  // =========================================================================
  describe("Hành trình 2: Buyer xác nhận nhận hàng -> Profile cập nhật Loyalty & DinoPoint", () => {
    it("Buyer bấm 'Đã nhận được hàng' và Profile cập nhật điểm/hạng/lịch sử giao dịch", async () => {
      // Đơn hàng mock có sẵn ở trạng thái SHIPPING
      const orderId = "00000000-0000-0000-0000-000000000303";

      // 1. Kiểm tra đơn hàng đang ở trạng thái SHIPPING
      const initialOrder = await orderRepo.getOrderById(orderId);
      expect(initialOrder.status).toBe("SHIPPING");

      // 2. Buyer xác nhận nhận hàng thành công
      expect(orderRepo.confirmReceived).toBeDefined();
      const completedOrder = await orderRepo.confirmReceived!(orderId);
      expect(completedOrder.id).toBe(orderId);
      expect(completedOrder.status).toBe("COMPLETED");

      // 3. Mô phỏng profile lấy thông tin tích điểm sau khi đơn hàng hoàn tất
      // Giả lập buyer được tích điểm x1 (89 điểm cho đơn 890.000đ)
      vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
        tier: "STANDARD",
        total_spent: "890000.00",
        loyalty_points: 89,
        vip_threshold: "5000000.00",
        points_multiplier: 1,
        next_tier: "VIP",
      });

      vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({
        items: [
          {
            transaction_id: "tx-loyalty-001",
            points_delta: 89,
            reference_order_id: orderId,
            reason: "ORDER_COMPLETED",
            created_at: new Date().toISOString(),
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      });

      // 4. Render BuyerLoyaltyCard trong trang Profile
      render(<BuyerLoyaltyCard />);

      // Đợi component load dữ liệu từ buyerApi
      await waitFor(() => {
        expect(screen.getByText("Hạng thành viên & DinoPoint")).toBeTruthy();
      });

      // Xác minh điểm thưởng và tiến trình
      expect(screen.getByText("89")).toBeTruthy();
      expect(screen.getByText(/Tiến trình hạng VIP/)).toBeTruthy();

      // Xác minh lịch sử giao dịch chứa đơn hàng vừa hoàn tất
      expect(screen.getByText("Hoàn tất đơn hàng")).toBeTruthy();
      expect(screen.getByText("+89")).toBeTruthy();
      expect(screen.getByText(`#${orderId.slice(0, 8)}`)).toBeTruthy();
    });

    it("Buyer vượt mốc 5.000.000đ được nâng hạng lên VIP với đặc quyền x2 DinoPoint", async () => {
      // Giả lập Buyer hoàn tất đơn hàng lớn, nâng tổng chi tiêu lên 5.200.000đ
      vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
        tier: "VIP",
        total_spent: "5200000.00",
        loyalty_points: 520,
        vip_threshold: "5000000.00",
        points_multiplier: 2,
        next_tier: null,
      });

      vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({
        items: [
          {
            transaction_id: "tx-vip-002",
            points_delta: 50,
            reference_order_id: "order-vip-001",
            reason: "ORDER_COMPLETED",
            created_at: new Date().toISOString(),
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
      });

      render(<BuyerLoyaltyCard />);

      await waitFor(() => {
        expect(screen.getByText("VIP")).toBeTruthy();
      });

      expect(screen.getByText(/x2 điểm DinoPoint/)).toBeTruthy();
      expect(screen.getByText("520")).toBeTruthy();
      expect(screen.getByText("Đạt VIP")).toBeTruthy();
    });
  });
});
