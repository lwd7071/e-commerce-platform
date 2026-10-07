// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartScreen } from "@/features/cart/cart-screen";
import { cartRepository } from "@/features/cart/cart.repository";
import type { CartItem } from "@/features/cart/cart.types";
import { QueryProvider } from "@/lib/query/query-provider";
import { clearAppQueryCache } from "@/lib/query/query-client";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/cart/cart.repository", () => ({
  cartRepository: {
    getCart: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    removeSelected: vi.fn(),
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockCartRepository = vi.mocked(cartRepository);

const authValue = (id: string, email: string): AuthContextType => ({
  user: { id, email, role: "BUYER" },
  accessToken: null,
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(async () => "mock"),
  loginWithGoogle: vi.fn(),
  verifySignupOtp: vi.fn(),
  resendSignupOtp: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  completeOnboarding: vi.fn(),
  reloadUser: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => true),
});

const cartItem = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: "cart-item-1",
  variantId: "variant-1",
  productId: "product-1",
  productName: "Áo Dino",
  variantName: "M",
  price: "100000.00",
  quantity: 1,
  stock: 5,
  shopId: "shop-1",
  shopName: "Dino Shop",
  imageUrl: null,
  isSelected: true,
  isAvailable: true,
  productStatus: "ACTIVE",
  variantStatus: "ACTIVE",
  shopStatus: "ACTIVE",
  ...overrides,
});

function renderCart() {
  return render(<QueryProvider><CartScreen /></QueryProvider>);
}

describe("Cart query cache", () => {
  beforeEach(() => {
    cleanup();
    clearAppQueryCache();
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue(authValue("buyer-1", "buyer@test.vn"));
    vi.mocked(mockCartRepository.getCart).mockResolvedValue([cartItem()]);
    vi.mocked(mockCartRepository.updateItem).mockResolvedValue(undefined);
    vi.mocked(mockCartRepository.removeItem).mockResolvedValue(undefined);
    vi.mocked(mockCartRepository.removeSelected).mockResolvedValue(undefined);
  });

  it("reuses cached cart data when the user returns before it becomes stale", async () => {
    const first = renderCart();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Giỏ hàng (1 sản phẩm)" })).toBeTruthy());
    expect(cartRepository.getCart).toHaveBeenCalledTimes(1);

    first.unmount();
    renderCart();

    expect(screen.getByRole("heading", { name: "Giỏ hàng (1 sản phẩm)" })).toBeTruthy();
    expect(cartRepository.getCart).toHaveBeenCalledTimes(1);
  });

  it("keeps cached carts isolated between accounts", async () => {
    vi.mocked(mockCartRepository.getCart)
      .mockResolvedValueOnce([cartItem({ productName: "Giỏ tài khoản A" })])
      .mockResolvedValueOnce([cartItem({ productName: "Giỏ tài khoản B" })]);
    const view = renderCart();
    await waitFor(() => expect(screen.getByText("Giỏ tài khoản A")).toBeTruthy());

    mockUseAuth.mockReturnValue(authValue("buyer-2", "second@test.vn"));
    view.rerender(<QueryProvider><CartScreen /></QueryProvider>);

    expect(screen.queryByText("Giỏ tài khoản A")).toBeNull();
    await waitFor(() => expect(screen.getByText("Giỏ tài khoản B")).toBeTruthy());
    expect(cartRepository.getCart).toHaveBeenCalledTimes(2);
  });

  it("optimistically updates quantity, refreshes after success, and rolls back after failure", async () => {
    let serverItems = [cartItem()];
    vi.mocked(mockCartRepository.getCart).mockImplementation(async () => serverItems);
    vi.mocked(mockCartRepository.updateItem).mockImplementation(async (_id, patch) => {
      if (patch.quantity !== undefined) {
        serverItems = serverItems.map((item) => ({ ...item, quantity: patch.quantity! }));
      }
    });

    const view = renderCart();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Giỏ hàng (1 sản phẩm)" })).toBeTruthy());
    const quantity = () => view.container.querySelector("article span.w-10")?.textContent;
    expect(quantity()).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng" }));
    await waitFor(() => expect(quantity()).toBe("2"));
    expect(cartRepository.getCart).toHaveBeenCalledTimes(2);

    vi.mocked(mockCartRepository.updateItem).mockRejectedValueOnce(new Error("request failed"));
    fireEvent.click(screen.getByRole("button", { name: "Tăng số lượng" }));
    await waitFor(() => expect(quantity()).toBe("2"));
    expect(screen.getByText("Không thể cập nhật số lượng.")).toBeTruthy();
  });

  it("refetches after a partial failure while selecting multiple cart items", async () => {
    let serverItems = [cartItem({ isSelected: false }), cartItem({ id: "cart-item-2", productName: "Nón Dino", isSelected: false })];
    vi.mocked(mockCartRepository.getCart).mockImplementation(async () => serverItems);
    vi.mocked(mockCartRepository.updateItem)
      .mockImplementationOnce(async (id, patch) => {
        serverItems = serverItems.map((item) => item.id === id ? { ...item, isSelected: Boolean(patch.is_selected) } : item);
      })
      .mockRejectedValueOnce(new Error("request failed"));

    renderCart();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Giỏ hàng (2 sản phẩm)" })).toBeTruthy());
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả (2 sản phẩm)" }));

    await waitFor(() => expect(cartRepository.getCart).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("checkbox", { name: "Chọn sản phẩm Áo Dino" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Chọn sản phẩm Nón Dino" }) as HTMLInputElement).checked).toBe(false);
  });
});
