import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getNavigationItems } from "@/components/navigation/navigation-items";
import { ProtectedPage } from "@/components/navigation/protected-page";
import {
  countUnreadNotifications,
  filterNotifications,
  markNotificationRead,
  markVisibleNotificationsRead,
  type NotificationRow,
} from "@/features/notifications/notification-state";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";

vi.mock("@/lib/auth/auth-context", () => ({ useAuth: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/notifications",
  useRouter: () => ({ replace: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);

beforeEach(() => mockUseAuth.mockReset());

describe("role-based navigation matrix", () => {
  it("shows only the documented guest destinations", () => {
    expect(getNavigationItems(null).map((item) => item.label)).toEqual(["Khám phá"]);
  });

  it("shows buyer, seller and admin destinations only to their role", () => {
    expect(getNavigationItems("BUYER").map((item) => item.href)).toEqual([
      "/", "/cart", "/orders", "/notifications", "/profile",
    ]);
    expect(getNavigationItems("SELLER").map((item) => item.href)).toEqual([
      "/", "/notifications", "/profile", "/seller", "/seller/shop", "/seller/orders", "/seller/chat", "/seller/products", "/seller/vouchers", "/seller/reports",
    ]);
    expect(getNavigationItems("ADMIN").map((item) => item.href)).toEqual([
      "/", "/profile", "/admin", "/admin/categories",
    ]);
  });
});

describe("notification direct-route role guard", () => {
  it("renders a safe unauthorized state for a seller opening a buyer-only route", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "seller-1", email: "seller@example.test", role: "SELLER" },
      isLoading: false,
    } as AuthContextType);

    const markup = renderToStaticMarkup(
      <ProtectedPage allowedRoles={["BUYER"]}><p>Buyer notification data</p></ProtectedPage>,
    );
    expect(markup).toContain("Bạn không có quyền xem trang này");
    expect(markup).toContain("Quay lại khu vực của bạn");
    expect(markup).not.toContain("Buyer notification data");
  });

  it("allows a buyer to open the buyer-only route", () => {
    mockUseAuth.mockReturnValue({
      user: { id: "buyer-1", email: "buyer@example.test", role: "BUYER" },
      isLoading: false,
    } as AuthContextType);

    const markup = renderToStaticMarkup(
      <ProtectedPage allowedRoles={["BUYER"]}><p>Buyer notification data</p></ProtectedPage>,
    );
    expect(markup).toContain("Buyer notification data");
    expect(markup).not.toContain("Bạn không có quyền xem trang này");
  });
});

describe("notification view-state helpers", () => {
  const rows: NotificationRow[] = Array.from({ length: 23 }, (_, index) => ({
    id: "notice-" + (index + 1),
    title: "Thông báo " + (index + 1),
    body: "Nội dung demo",
    createdAt: "Ví dụ: hôm nay",
    isRead: index === 0,
  }));

  it("filters unread rows and counts them", () => {
    expect(countUnreadNotifications(rows)).toBe(22);
    expect(filterNotifications(rows, "unread")).toHaveLength(22);
    expect(filterNotifications(rows, "all")).toEqual(rows);
  });

  it("marks one row read without mutating the input", () => {
    const next = markNotificationRead(rows, "notice-2");
    expect(next[1].isRead).toBe(true);
    expect(rows[1].isRead).toBe(false);
    expect(next[0]).toBe(rows[0]);
  });

  it("marks at most 20 visible unread rows and leaves remaining rows unchanged", () => {
    const next = markVisibleNotificationsRead(rows, "all");
    expect(next.filter((row) => row.isRead)).toHaveLength(21);
    expect(next[20].isRead).toBe(true);
    expect(next[21].isRead).toBe(false);
    expect(next[22].isRead).toBe(false);
    expect(rows[1].isRead).toBe(false);
  });
});
