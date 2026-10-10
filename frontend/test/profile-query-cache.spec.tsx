// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { ProfilePageContent } from "@/features/profile/profile-screen";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";
import { buyerApi, type WireProfile } from "@/lib/api/buyer.api";
import { QueryProvider } from "@/lib/query/query-provider";
import { clearAppQueryCache } from "@/lib/query/query-client";
import { ToastProvider } from "@/components/ui/toast";

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/profile",
}));

vi.mock("@/lib/api/buyer.api", () => ({
  buyerApi: {
    getProfile: vi.fn(),
    getLoyalty: vi.fn(),
    getLoyaltyHistory: vi.fn(),
    updateProfile: vi.fn(),
    updateAvatar: vi.fn(),
    getAddresses: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/features/profile/address-manager", () => ({
  AddressManager: () => <div data-testid="address-manager">Địa chỉ giao hàng</div>,
}));

const mockUseAuth = vi.mocked(useAuth);

const authValue = (id: string, email: string): AuthContextType => ({
  user: { id, email, role: "BUYER" },
  accessToken: null,
  isLoading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(async () => "mock" as const),
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

describe("Profile TanStack Query Cache & Instant Navigation (Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAppQueryCache();
  });

  it("caches profile and loyalty data so navigating away and returning renders instantly with 0 re-fetches", async () => {
    mockUseAuth.mockReturnValue(authValue("buyer-1", "buyer@test.vn"));

    vi.mocked(buyerApi.getProfile).mockResolvedValue({
      full_name: "Lê Văn B",
      phone: "0909090909",
      avatar_url: null,
    });

    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
      tier: "VIP",
      total_spent: "7000000.00",
      loyalty_points: 750,
      vip_threshold: "5000000.00",
      points_multiplier: 2,
      next_tier: null,
    });

    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
    });

    // Lần 1: User truy cập trang Profile lần đầu
    const { unmount } = render(
      <QueryProvider>
        <ToastProvider>
          <ProfilePageContent />
        </ToastProvider>
      </QueryProvider>
    );

    // Chờ màn hình tải xong dữ liệu
    await waitFor(() => {
      expect(screen.getByDisplayValue("Lê Văn B")).toBeTruthy();
    });
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(buyerApi.getProfile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(buyerApi.getLoyaltyHistory).toHaveBeenCalledTimes(1));

    // Giả lập User chuyển tab sang trang khác (Trang chủ / Giỏ hàng) -> Profile bị unmount
    unmount();

    // Lần 2: User bấm quay lại tab Profile
    render(
      <QueryProvider>
        <ToastProvider>
          <ProfilePageContent />
        </ToastProvider>
      </QueryProvider>
    );

    // Data phải xuất hiện TỨC THÌ từ Cache RAM mà không kích hoạt gọi lại API lần thứ 2
    expect(screen.getByDisplayValue("Lê Văn B")).toBeTruthy();
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(buyerApi.getProfile).toHaveBeenCalledTimes(1);
    expect(buyerApi.getLoyalty).toHaveBeenCalledTimes(1);
    expect(buyerApi.getLoyaltyHistory).toHaveBeenCalledTimes(1);
  });

  it("does not show the previous account profile after the active user changes", async () => {
    mockUseAuth.mockReturnValue(authValue("buyer-1", "first@test.vn"));
    vi.mocked(buyerApi.getProfile)
      .mockResolvedValueOnce({ full_name: "Tài khoản A", phone: null, avatar_url: null } satisfies WireProfile)
      .mockResolvedValueOnce({ full_name: "Tài khoản B", phone: null, avatar_url: null } satisfies WireProfile);
    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
      tier: "STANDARD",
      total_spent: "0.00",
      loyalty_points: 0,
      vip_threshold: "5000000.00",
      points_multiplier: 1,
      next_tier: "VIP",
    });
    vi.mocked(buyerApi.getLoyaltyHistory).mockResolvedValue({ items: [], page: 1, limit: 10, total: 0 });

    const view = render(
      <QueryProvider>
        <ToastProvider>
          <ProfilePageContent />
        </ToastProvider>
      </QueryProvider>
    );
    await waitFor(() => expect(screen.getByDisplayValue("Tài khoản A")).toBeTruthy());

    mockUseAuth.mockReturnValue(authValue("buyer-2", "second@test.vn"));
    view.rerender(
      <QueryProvider>
        <ToastProvider>
          <ProfilePageContent />
        </ToastProvider>
      </QueryProvider>
    );

    expect(screen.queryByDisplayValue("Tài khoản A")).toBeNull();
    await waitFor(() => expect(screen.getByDisplayValue("Tài khoản B")).toBeTruthy());
    expect(buyerApi.getProfile).toHaveBeenCalledTimes(2);
  });
});
