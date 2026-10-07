// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProfilePageContent } from "@/features/profile/profile-screen";
import { useAuth } from "@/lib/auth/auth-context";
import type { AuthContextType } from "@/lib/auth/types";
import { buyerApi, type WireProfile } from "@/lib/api/buyer.api";

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
  },
}));

vi.mock("@/features/profile/address-manager", () => ({
  AddressManager: () => <div data-testid="address-manager">Địa chỉ giao hàng</div>,
}));

import { ToastProvider } from "@/components/ui/toast";

const mockUseAuth = vi.mocked(useAuth);

const authValue: AuthContextType = {
  user: { id: "buyer-1", email: "buyer@test.vn", role: "BUYER" },
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
};

describe("ProfilePageContent Parallel Data Orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orchestrates profile, loyalty, and loyalty history in parallel for BUYER role", async () => {
    mockUseAuth.mockReturnValue(authValue);

    vi.mocked(buyerApi.getProfile).mockResolvedValue({
      full_name: "Nguyễn Văn A",
      phone: "0912345678",
      avatar_url: null,
    } satisfies WireProfile);

    vi.mocked(buyerApi.getLoyalty).mockResolvedValue({
      tier: "VIP",
      total_spent: "6000000.00",
      loyalty_points: 600,
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

    render(
      <ToastProvider>
        <ProfilePageContent />
      </ToastProvider>
    );

    // Chờ màn hình ready
    await waitFor(() => {
      expect(screen.getByDisplayValue("Nguyễn Văn A")).toBeTruthy();
    });

    // Cả 3 API được gọi song song ngay từ đầu
    expect(buyerApi.getProfile).toHaveBeenCalledTimes(1);
    expect(buyerApi.getLoyalty).toHaveBeenCalledTimes(1);
    expect(buyerApi.getLoyaltyHistory).toHaveBeenCalledTimes(1);

    // Thẻ thành viên render đồng bộ với thông tin VIP
    expect(screen.getByText("VIP")).toBeTruthy();
    expect(screen.getByText("600")).toBeTruthy();
  });
});
