// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPageContent } from "@/features/notifications/notifications-screen";
import { buyerApi } from "@/lib/api/buyer.api";

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "buyer01@dino-demo.test", role: "BUYER" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/components/navigation/protected-page", () => ({
  ProtectedPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/api/buyer.api", () => ({
  buyerApi: {
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  },
}));

describe("NotificationsPageContent Live Integration (TDD)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_NOTIFICATIONS_API;
    process.env.NEXT_PUBLIC_USE_MOCK = "false";
  });

  it("tự động kích hoạt live repository và hiển thị thông báo khi kết nối live backend (NEXT_PUBLIC_USE_MOCK=false) trong môi trường production", async () => {
    vi.mocked(buyerApi.getNotifications).mockResolvedValue([
      {
        notificationId: "notif-1",
        recipientId: "user-1",
        type: "ORDER",
        title: "Đơn hàng #DN1010 đã được giao thành công",
        content: "Kiện hàng của bạn đã được giao đến nơi.",
        isRead: false,
        createdAt: "2026-10-10T10:00:00.000Z",
        readAt: null,
      },
    ]);

    // Render with production = true, where previously it blocked with "Thông báo chưa khả dụng"
    render(<NotificationsPageContent production={true} />);

    // Không được hiển thị màn hình lỗi "Thông báo chưa khả dụng"
    expect(screen.queryByRole("heading", { name: "Thông báo chưa khả dụng" })).toBeNull();

    // Phải hiển thị tiêu đề thông báo từ live API
    expect(await screen.findByText("Đơn hàng #DN1010 đã được giao thành công")).not.toBeNull();
    expect(buyerApi.getNotifications).toHaveBeenCalledTimes(1);
  });
});
