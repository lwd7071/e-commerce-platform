// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UserDropdown } from "@/components/navigation/user-dropdown";

describe("UserDropdown component", () => {
  it("is collapsed by default and opens on clicking the avatar trigger", () => {
    render(
      <UserDropdown
        user={{ email: "user@example.test", role: "BUYER" }}
        onLogout={vi.fn()}
      />
    );

    // Ban đầu menu chưa hiển thị
    expect(screen.queryByRole("menu")).toBeNull();

    // Bấm vào avatar trigger
    const trigger = screen.getByRole("button", { name: /tài khoản|menu người dùng/i });
    fireEvent.click(trigger);

    // Menu xuất hiện
    expect(screen.getByRole("menu")).not.toBeNull();
    expect(screen.getByText("Tài khoản")).not.toBeNull();
  });

  it("shows 'Kênh người bán' only when user has SELLER role", () => {
    // Với BUYER
    const { unmount } = render(
      <UserDropdown
        user={{ email: "buyer@example.test", role: "BUYER" }}
        onLogout={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /tài khoản|menu người dùng/i }));
    expect(screen.queryByText("Kênh người bán")).toBeNull();
    unmount();

    // Với SELLER
    render(
      <UserDropdown
        user={{ email: "seller@example.test", role: "SELLER" }}
        onLogout={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /tài khoản|menu người dùng/i }));
    expect(screen.getByText("Kênh người bán")).not.toBeNull();
  });

  it("calls onLogout callback when clicking Đăng xuất", () => {
    const handleLogout = vi.fn();
    render(
      <UserDropdown
        user={{ email: "user@example.test", role: "BUYER" }}
        onLogout={handleLogout}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /tài khoản|menu người dùng/i }));
    const logoutBtn = screen.getByRole("menuitem", { name: /đăng xuất/i });
    fireEvent.click(logoutBtn);

    expect(handleLogout).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape key is pressed", () => {
    render(
      <UserDropdown
        user={{ email: "user@example.test", role: "BUYER" }}
        onLogout={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /tài khoản|menu người dùng/i }));
    expect(screen.getByRole("menu")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
