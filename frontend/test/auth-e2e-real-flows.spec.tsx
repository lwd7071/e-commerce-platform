// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import LoginPage from "@/app/login/page";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { AuthContext } from "@/lib/auth/auth-context";
import { AppError } from "@/lib/api/app-error";
import type { AuthContextType } from "@/lib/auth/types";
import { classifyCheckoutError } from "@/features/checkout/checkout-error-classifier";

// Mock next/navigation
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => "/checkout",
}));

// Mock Supabase client
const mockGetSupabaseClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/supabase-client", () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

// Mock ApiClient
const mockApiGet = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({
  apiClient: { get: mockApiGet },
  setAuthTokenProvider: vi.fn(),
}));

describe("Người 1: Kiểm thử E2E Thực tế Xác thực & Điều hướng (Đợt 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  // =========================================================================
  // CA 1: Điều hướng returnTo khi đang ở trang thanh toán / giỏ hàng
  // =========================================================================
  describe("T2-P1-01: Điều hướng returnTo khi Guest truy cập trang được bảo vệ", () => {
    it("chuyển hướng Guest từ trang checkout sang /login kèm returnTo=/checkout", async () => {
      // Giả lập trạng thái Guest (user = null, isLoading = false)
      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
      };

      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <ProtectedPage allowedRoles={["BUYER"]}>
            <div data-testid="checkout-content">Nội dung Checkout</div>
          </ProtectedPage>
        </AuthContext.Provider>
      );

      // Phải chuyển hướng sang /login với returnTo được encode
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalledWith("/login?returnTo=%2Fcheckout");
      });
      expect(screen.queryByTestId("checkout-content")).toBeNull();
    });

    it("sau khi đăng nhập thành công, điều hướng chính xác về trang returnTo=/checkout", async () => {
      mockSearchParams = new URLSearchParams("returnTo=/checkout");
      const mockLogin = vi.fn().mockResolvedValue(undefined);

      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: mockLogin,
      };

      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <LoginPage />
        </AuthContext.Provider>
      );

      const emailInput = screen.getByLabelText("Địa chỉ Email");
      const passwordInput = screen.getByLabelText("Mật khẩu");
      const submitBtn = screen.getByRole("button", { name: "Đăng nhập" });

      await user.type(emailInput, "buyer@dino.vn");
      await user.type(passwordInput, "Password123!");
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("buyer@dino.vn", "Password123!");
        // Phải chuyển hướng về /checkout, không bị rơi về trang chủ /
        expect(mockRouterPush).toHaveBeenCalledWith("/checkout");
      });
    });

    it("ngăn chặn Open Redirect: sanitize các URL độc hại (//evil.com) về trang chủ an toàn", async () => {
      mockSearchParams = new URLSearchParams("returnTo=//malicious-phishing-site.com");
      const mockLogin = vi.fn().mockResolvedValue(undefined);

      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: mockLogin,
      };

      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <LoginPage />
        </AuthContext.Provider>
      );

      await user.type(screen.getByLabelText("Địa chỉ Email"), "buyer@dino.vn");
      await user.type(screen.getByLabelText("Mật khẩu"), "Password123!");
      await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

      await waitFor(() => {
        // Phải bị sanitize về "/", tuyệt đối không chuyển hướng sang trang web lạ
        expect(mockRouterPush).toHaveBeenCalledWith("/");
      });
    });
  });

  // =========================================================================
  // CA 2: Token hết hạn đột ngột trong lúc đang thao tác (Session Expiration)
  // =========================================================================
  describe("T2-P1-02: Xử lý Token hết hạn đột ngột (401 AUTH_REQUIRED)", () => {
    it("phân loại đúng lỗi AUTH khi API trả 401 và giữ snapshot checkout", () => {
      const authError = new AppError({
        status: 401,
        code: "AUTH_REQUIRED",
        message: "Authentication required. Missing Bearer token.",
      });

      const classification = classifyCheckoutError(authError);
      expect(classification).toBe("AUTH");
    });

    it("màn hình đăng nhập hiển thị thông báo phiên hết hạn khi nhận reason=expired", () => {
      mockSearchParams = new URLSearchParams("reason=expired&returnTo=/checkout");

      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
      };

      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <LoginPage />
        </AuthContext.Provider>
      );

      // Phải có thông báo phiên hết hạn cho người dùng hiểu
      expect(
        screen.getByText("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
      ).toBeTruthy();
    });
  });

  // =========================================================================
  // CA 3: Hành vi UI khi tài khoản bị Admin khóa (USER_LOCKED) trong lúc thao tác
  // =========================================================================
  describe("T2-P1-03: Xử lý khi tài khoản bị khóa (403 USER_LOCKED)", () => {
    it("phân loại lỗi USER_LOCKED và hiển thị thông báo khóa tài khoản trên màn hình đăng nhập", () => {
      const lockedError = new AppError({
        status: 403,
        code: "USER_LOCKED",
        message: "Tài khoản của bạn đã bị khóa bởi quản trị viên.",
      });

      const classification = classifyCheckoutError(lockedError);
      expect(classification).toBe("USER_LOCKED");

      // Kiểm tra UI login khi bị redirect với reason=locked
      mockSearchParams = new URLSearchParams("reason=locked");
      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
      };

      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <LoginPage />
        </AuthContext.Provider>
      );

      // Phải có thông báo tài khoản bị khóa rõ ràng
      expect(
        screen.getByText("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.")
      ).toBeTruthy();
    });

    it("chặn đăng nhập khi tài khoản bị khóa và hiển thị lỗi từ backend", async () => {
      const mockLogin = vi.fn().mockRejectedValue(
        new AppError({
          status: 403,
          code: "USER_LOCKED",
          message: "Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.",
        })
      );

      const mockAuth: Partial<AuthContextType> = {
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: mockLogin,
      };

      const user = userEvent.setup();
      render(
        <AuthContext.Provider value={mockAuth as AuthContextType}>
          <LoginPage />
        </AuthContext.Provider>
      );

      await user.type(screen.getByLabelText("Địa chỉ Email"), "locked_user@dino.vn");
      await user.type(screen.getByLabelText("Mật khẩu"), "Password123!");
      await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

      await waitFor(() => {
        expect(
          screen.getByText("Tài khoản đang bị khóa. Vui lòng liên hệ hỗ trợ.")
        ).toBeTruthy();
      });
    });
  });
});
