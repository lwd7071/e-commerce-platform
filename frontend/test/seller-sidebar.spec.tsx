// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SellerSidebar } from "@/components/navigation/seller-sidebar";

let currentMockPath = "/seller";

vi.mock("next/navigation", () => ({
  usePathname: () => currentMockPath,
}));

describe("SellerSidebar component", () => {
  it("renders all sidebar groups and child items", () => {
    currentMockPath = "/seller";
    render(<SellerSidebar />);

    // Kiểm tra các đề mục chính
    expect(screen.getByText("Tổng quan")).not.toBeNull();
    expect(screen.getByText("Đơn hàng")).not.toBeNull();
    expect(screen.getByText("Đơn bán")).not.toBeNull();
    expect(screen.getByText("Tin nhắn khách hàng")).not.toBeNull();
    expect(screen.getByText("Sản phẩm")).not.toBeNull();
    expect(screen.getByText("Marketing")).not.toBeNull();
    expect(screen.getByText("Mã giảm giá")).not.toBeNull();
    expect(screen.getByText("Báo cáo")).not.toBeNull();
    expect(screen.getByText("Doanh thu")).not.toBeNull();
    expect(screen.getByText("Hồ sơ gian hàng")).not.toBeNull();
  });

  it("marks the active link based on current pathname", () => {
    currentMockPath = "/seller/orders";
    render(<SellerSidebar />);

    const activeLink = screen.getByRole("link", { name: /đơn bán/i });
    expect(activeLink.getAttribute("aria-current")).toBe("page");

    const inactiveLink = screen.getByRole("link", { name: /tin nhắn khách hàng/i });
    expect(inactiveLink.getAttribute("aria-current")).toBeNull();
  });
});
