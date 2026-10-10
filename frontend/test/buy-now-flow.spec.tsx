// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDetailScreen } from "@/features/catalog/product-detail-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  addToCart: vi.fn(),
  getCart: vi.fn(),
  updateCartItem: vi.fn(),
  getProduct: vi.fn(),
  getReviews: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/products/prod-1",
}));

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "buyer@example.com", role: "BUYER" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/repositories/repository-factory", () => ({
  repositories: {
    catalog: () => ({
      getProductById: mocks.getProduct,
    }),
    buyer: () => ({
      addToCart: mocks.addToCart,
      getCart: mocks.getCart,
      updateCartItem: mocks.updateCartItem,
    }),
    review: () => ({
      getReviewsByProduct: mocks.getReviews,
    }),
    chat: () => ({
      getShopPresence: vi.fn().mockResolvedValue({ is_online: false }),
    }),
  },
}));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => vi.fn(),
  ToastProvider: ({ children }: { children: ReactNode }) => children,
}));

const mockProduct = {
  product_id: "prod-1",
  product_name: "Áo Thun Dino TDD",
  description: "Mô tả sản phẩm test",
  category_id: "cat-1",
  category_name: "Thời trang",
  shop_id: "shop-1",
  shop_name: "Dino Shop",
  status: "ACTIVE" as const,
  image_url: "https://example.com/img.jpg",
  created_at: new Date().toISOString(),
  variants: [
    {
      variant_id: "var-1",
      product_id: "prod-1",
      variant_name: "Size L - Đen",
      price: "150000.00",
      stock_quantity: 10,
      status: "ACTIVE" as const,
    },
  ],
};

const existingCart = {
  cart_id: "cart-1",
  buyer_id: "user-1",
  items: [
    {
      cart_item_id: "item-other",
      variant_id: "var-other",
      quantity: 1,
      is_selected: true,
    },
    {
      cart_item_id: "item-1",
      variant_id: "var-1",
      quantity: 1,
      is_selected: false, // Ban đầu chưa được tick
    },
  ],
};

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Buy Now Flow on Product Detail Screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProduct.mockResolvedValue(mockProduct);
    mocks.getReviews.mockResolvedValue([]);
    mocks.addToCart.mockResolvedValue({
      cart_item_id: "item-1",
      variant_id: "var-1",
      quantity: 1,
      is_selected: false,
    });
    mocks.getCart.mockResolvedValue(existingCart);
    mocks.updateCartItem.mockResolvedValue({});
  });

  afterEach(() => cleanup());

  it("hiển thị nút 'Mua ngay' cạnh nút 'Thêm vào giỏ hàng'", async () => {
    renderWithClient(<ProductDetailScreen productId="prod-1" />);

    expect(await screen.findByRole("button", { name: /Thêm Vào Giỏ Hàng/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Mua Ngay/i })).toBeTruthy();
  });

  it("khi bấm 'Mua ngay' sẽ chọn độc quyền sản phẩm vừa mua (is_selected = true) và chuyển hướng sang /checkout", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProductDetailScreen productId="prod-1" />);

    const buyNowBtn = await screen.findByRole("button", { name: /Mua Ngay/i });
    await user.click(buyNowBtn);

    await waitFor(() => {
      expect(mocks.addToCart).toHaveBeenCalledWith("var-1", 1);
    });

    // Món đồ vừa mua phải được đảm bảo is_selected: true
    await waitFor(() => {
      expect(mocks.updateCartItem).toHaveBeenCalledWith("item-1", { is_selected: true });
    });

    // Món đồ khác trong giỏ phải được bỏ chọn để tránh mua nhầm
    expect(mocks.updateCartItem).toHaveBeenCalledWith("item-other", { is_selected: false });

    expect(mocks.push).toHaveBeenCalledWith("/checkout");
  });
});
