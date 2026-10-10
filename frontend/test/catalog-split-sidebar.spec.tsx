// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CatalogListScreen } from "@/features/catalog/catalog-list-screen";
import { categoryAdapter } from "@/lib/adapters/category.adapter";

// Mock router / pathname
vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Catalog Split Sidebar UI (Phương án 2 - Classic Commerce Split)", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/products");
  });

  it("renders classic commerce sidebar with clean categories and filters out junk test categories", async () => {
    // Giả lập danh sách danh mục có cả danh mục thật lẫn danh mục rác test
    vi.spyOn(categoryAdapter, "getCategories").mockResolvedValue([
      { id: "cat-1", parentId: null, name: "Thiết bị điện tử", status: "ACTIVE" },
      { id: "cat-2", parentId: null, name: "Thời trang & Phụ kiện", status: "ACTIVE" },
      { id: "cat-junk-1", parentId: null, name: "Cat a7979a85", status: "ACTIVE" },
      { id: "cat-junk-2", parentId: null, name: "Flash Tech 1790924495471", status: "ACTIVE" },
      { id: "cat-junk-3", parentId: null, name: "E2E Category", status: "ACTIVE" },
    ]);

    render(<CatalogListScreen />);

    // Kiểm tra cấu trúc sidebar chuẩn sàn TMĐT
    expect(await screen.findByRole("complementary", { name: /Bộ lọc tìm kiếm/i })).toBeTruthy();

    // Các danh mục thật phải hiển thị
    expect(screen.getByText("Thiết bị điện tử")).toBeTruthy();
    expect(screen.getByText("Thời trang & Phụ kiện")).toBeTruthy();

    // Các danh mục rác do test/seed sinh ra phải bị lọc bỏ
    expect(screen.queryByText("Cat a7979a85")).toBeNull();
    expect(screen.queryByText("Flash Tech 1790924495471")).toBeNull();
    expect(screen.queryByText("E2E Category")).toBeNull();
  });

  it("cho phép chọn danh mục từ sidebar và kích hoạt trạng thái lọc", async () => {
    vi.spyOn(categoryAdapter, "getCategories").mockResolvedValue([
      { id: "cat-electronics", parentId: null, name: "Thiết bị điện tử", status: "ACTIVE" },
    ]);

    render(<CatalogListScreen />);

    const catBtn = await screen.findByText("Thiết bị điện tử");
    await userEvent.click(catBtn);

    await waitFor(() => {
      expect(window.location.search).toContain("category_id=cat-electronics");
    });
  });

  it("hiển thị nút 'Xóa tất cả' khi có bộ lọc được áp dụng và reset về mặc định", async () => {
    render(<CatalogListScreen initialShopTier="MALL" />);

    // Phải có nút Xóa tất cả bộ lọc khi đang lọc Mall
    const resetBtn = await screen.findByRole("button", { name: /Xóa tất cả/i });
    expect(resetBtn).toBeTruthy();

    await userEvent.click(resetBtn);

    await waitFor(() => {
      expect(window.location.search).not.toContain("shop_tier=MALL");
    });
  });
});
