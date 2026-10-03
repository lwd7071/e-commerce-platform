// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Dialog } from "@/components/ui/dialog";
import { ToastProvider } from "@/components/ui/toast";
import { AdminScreen } from "@/features/admin/admin-screen";
import { AdminShopsScreen } from "@/features/admin/admin-shops-screen";
import { features } from "@/lib/config/features";
import { resetMockAdminStore } from "@/features/admin/admin.repository";

describe("Admin Portal: Accessibility, Keyboard Navigation & Responsive Contracts (ADMIN-12)", () => {
  beforeEach(() => {
    resetMockAdminStore();
    vi.spyOn(features.domains, "adminMock").mockReturnValue(true);

    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event("close"));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders modal Dialog with accessible name, description, and closes on Escape / close button", () => {
    const handleClose = vi.fn();

    // Render Dialog
    const { rerender } = render(
      <Dialog
        open={true}
        onOpenChange={handleClose}
        title="Xác nhận khóa tài khoản người dùng"
        description="Tài khoản: buyer@example.com (Nguyen Van A)"
      >
        <div>
          <label htmlFor="reason-input">Lý do khóa</label>
          <input id="reason-input" />
        </div>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    // Kiểm tra aria-labelledby và title
    expect(screen.getByRole("heading", { name: "Xác nhận khóa tài khoản người dùng" })).toBeTruthy();
    expect(screen.getByText("Tài khoản: buyer@example.com (Nguyen Van A)")).toBeTruthy();

    // Kiểm tra nút Đóng hộp thoại có accessible label
    const closeBtn = screen.getByRole("button", { name: "Đóng hộp thoại" });
    expect(closeBtn).toBeTruthy();

    // Nhấn nút Đóng hộp thoại
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledWith(false);

    // Bấm phím Escape trên dialog
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    fireEvent(dialog, new Event("close"));
    expect(handleClose).toHaveBeenCalledWith(false);

    // Khi open = false -> đóng
    rerender(
      <Dialog
        open={false}
        onOpenChange={handleClose}
        title="Xác nhận khóa tài khoản người dùng"
      >
        <div />
      </Dialog>
    );
  });

  it("ensures Admin User management screen has accessible filters, headings, and data table landmarks", async () => {
    render(
      <ToastProvider>
        <AdminScreen />
      </ToastProvider>
    );

    // Heading chính
    expect(screen.getByRole("heading", { level: 1, name: "Quản Lý Người Dùng & Kiểm Duyệt" })).toBeTruthy();

    // Search input có placeholder và tag input
    const searchInput = screen.getByPlaceholderText("Tìm theo email, họ tên, ID...");
    expect(searchInput).toBeTruthy();
    expect(searchInput.tagName).toBe("INPUT");

    // Filter selectors
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThanOrEqual(2); // Role filter & Status filter

    // Đợi tải xong và kiểm tra data table
    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(table).toBeTruthy();
      expect(table.closest(".overflow-x-auto")).toBeTruthy();
    });

    // Kiểm tra các cột tiêu đề table
    expect(screen.getByText("Người dùng")).toBeTruthy();
    expect(screen.getByText("Vai trò")).toBeTruthy();
    expect(screen.getByText("Trạng thái")).toBeTruthy();
    expect(screen.getByText("Thao tác")).toBeTruthy();
  });

  it("ensures Admin Shops management screen has accessible action buttons and responsive wrapper", async () => {
    render(
      <ToastProvider>
        <AdminShopsScreen />
      </ToastProvider>
    );

    expect(screen.getByRole("heading", { level: 1, name: "Quản Lý & Duyệt Gian Hàng" })).toBeTruthy();

    const searchInput = screen.getByPlaceholderText("Tìm theo tên shop, email chủ shop, ID...");
    expect(searchInput).toBeTruthy();
    expect(searchInput.tagName).toBe("INPUT");

    const statusFilter = screen.getByLabelText("Trạng thái:");
    expect(statusFilter).toBeTruthy();

    // Đợi tải xong và kiểm tra data table
    await waitFor(() => {
      const table = screen.getByRole("table");
      expect(table).toBeTruthy();
      expect(table.closest(".overflow-x-auto")).toBeTruthy();
    });

    // Kiểm tra các cột tiêu đề table
    expect(screen.getByText("Gian hàng")).toBeTruthy();
    expect(screen.getByText("Chủ sở hữu")).toBeTruthy();
    expect(screen.getByText("Sản phẩm")).toBeTruthy();
  });
});
