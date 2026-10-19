// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/navigation/app-shell";
import { useAuth } from "@/lib/auth/auth-context";

let currentRoute = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentRoute,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/notifications/notification-popover", () => ({
  NotificationPopover: () => null,
}));

const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  mockUseAuth.mockReset();
  mockUseAuth.mockReturnValue({
    user: { id: "seller-1", email: "seller@test.local", role: "SELLER" },
    logout: vi.fn(),
    isLoading: false,
  } as unknown as ReturnType<typeof useAuth>);
});

describe("AppShell route layout separation", () => {
  it("renders standard buyer layout on root or buyer routes", () => {
    currentRoute = "/";
    render(
      <AppShell>
        <div>Trang mua sắm</div>
      </AppShell>
    );

    expect(screen.getByText("Trang mua sắm")).not.toBeNull();
    // Không có seller sidebar trên trang buyer
    expect(screen.queryByLabelText("Thanh điều hướng người bán")).toBeNull();
  });

  it("renders seller layout with SellerSidebar when navigating to /seller routes", () => {
    currentRoute = "/seller/orders";
    render(
      <AppShell>
        <div>Quản lý đơn hàng</div>
      </AppShell>
    );

    expect(screen.getByText("Quản lý đơn hàng")).not.toBeNull();
    // Có thanh điều hướng người bán
    expect(screen.getByLabelText("Thanh điều hướng người bán")).not.toBeNull();
  });

  it("keeps sellers in the seller layout on the notifications page", () => {
    currentRoute = "/notifications";
    render(
      <AppShell>
        <div>Thông báo</div>
      </AppShell>
    );

    expect(screen.getByText("Thông báo")).not.toBeNull();
    expect(screen.getByLabelText("Thanh điều hướng người bán")).not.toBeNull();
    expect(screen.getByLabelText("Dino Kênh người bán")).not.toBeNull();
  });

  it("shows the floating chat only for buyers on shopping routes", () => {
    currentRoute = "/products";
    mockUseAuth.mockReturnValue({
      user: { id: "buyer-1", email: "buyer@test.local", role: "BUYER" },
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    const { unmount } = render(<AppShell><div>Sản phẩm</div></AppShell>);
    expect(screen.getByRole("button", { name: "Mở hộp thư chat" })).not.toBeNull();
    unmount();

    currentRoute = "/admin/orders";
    render(<AppShell><div>Quản trị</div></AppShell>);
    expect(screen.queryByRole("button", { name: "Mở hộp thư chat" })).toBeNull();
  });
});
