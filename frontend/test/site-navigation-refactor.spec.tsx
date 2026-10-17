// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/navigation/site-navigation";
import { useAuth } from "@/lib/auth/auth-context";

let currentPath = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/notifications/notification-popover", async () => {
  const { createElement } = await import("react");
  return { NotificationPopover: () => createElement("button", { type: "button", "aria-label": "Thông báo" }) };
});

const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe("SiteHeader with new role-based UI", () => {
  it("renders clean buyer navigation without cluttering seller tool links on public routes", () => {
    currentPath = "/";
    mockUseAuth.mockReturnValue({
      user: { id: "seller-1", email: "seller@test.local", role: "SELLER" },
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<SiteHeader role="SELLER" />);

    // Có Logo và tìm kiếm
    expect(screen.getByLabelText(/Dino - trang chủ/i)).not.toBeNull();
    expect(screen.getByRole("search")).not.toBeNull();

    // Không chứa các link công cụ của Seller trên thanh top nav
    expect(screen.queryByText("Đơn bán")).toBeNull();
    expect(screen.queryByText("Mã giảm giá")).toBeNull();
    expect(screen.queryByText("Báo cáo doanh thu")).toBeNull();

    // Không còn nút Đăng xuất trơ trọi bên ngoài
    expect(screen.queryByRole("button", { name: "Đăng xuất khỏi hệ thống" })).toBeNull();
    expect(screen.getByRole("button", { name: "Thông báo" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Thông báo" })).toBeNull();
  });

  it("renders dedicated seller header when in seller area", () => {
    currentPath = "/seller";
    mockUseAuth.mockReturnValue({
      user: { id: "seller-1", email: "seller@test.local", role: "SELLER" },
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<SiteHeader role="SELLER" isSellerArea={true} />);

    // Header của Seller có branding Seller Center và nút Quay lại mua sắm
    expect(screen.getByText(/Kênh người bán|Seller Center/i)).not.toBeNull();
    expect(screen.getByRole("link", { name: /quay lại mua sắm/i })).not.toBeNull();

    // Ẩn thanh tìm kiếm mua sắm của buyer trong header seller
    expect(screen.queryByRole("search")).toBeNull();
    expect(screen.getByRole("button", { name: "Thông báo" })).not.toBeNull();
  });

  it("provides the same notification popup trigger for buyers", () => {
    currentPath = "/";
    mockUseAuth.mockReturnValue({
      user: { id: "buyer-1", email: "buyer@test.local", role: "BUYER" },
      logout: vi.fn(),
      isLoading: false,
    } as unknown as ReturnType<typeof useAuth>);

    render(<SiteHeader role="BUYER" />);

    expect(screen.getByRole("button", { name: "Thông báo" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: "Thông báo" })).toBeNull();
  });
});
