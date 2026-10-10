// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import VerifyEmailPage from "@/app/verify-email/page";
import ForgotPasswordPage from "@/app/forgot-password/page";
import ResetPasswordPage from "@/app/reset-password/page";
import { useAuth } from "@/lib/auth/auth-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams("email=test%40dino.vn"),
}));

vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: vi.fn(),
}));

describe("Slice 4: Auth OTP and Password Recovery UI (TDD & UI/UX Pro Max)", () => {
  const mockVerifySignupOtp = vi.fn();
  const mockResendSignupOtp = vi.fn();
  const mockResetPassword = vi.fn();
  const mockUpdatePassword = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.mocked(useAuth).mockReturnValue({
      verifySignupOtp: mockVerifySignupOtp,
      resendSignupOtp: mockResendSignupOtp,
      requestPasswordReset: mockResetPassword,
      updatePassword: mockUpdatePassword,
      user: null,
      accessToken: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      loginWithGoogle: vi.fn(),
      register: vi.fn(),
      completeOnboarding: vi.fn(),
      reloadUser: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("VerifyEmailPage (OTP flow)", () => {
    it("disables submit button when OTP code has fewer than 6 digits", async () => {
      render(<VerifyEmailPage />);

      const otpInput = screen.getByLabelText("Mã xác minh");
      await userEvent.type(otpInput, "12345");

      const submitBtn = screen.getByRole("button", { name: "Xác minh" });
      expect(submitBtn.hasAttribute("disabled")).toBe(true);

      await userEvent.type(otpInput, "6");
      expect(submitBtn.hasAttribute("disabled")).toBe(false);
    });

    it("allows typing 6-digit OTP and submitting to verify", async () => {
      mockVerifySignupOtp.mockResolvedValueOnce(undefined);
      render(<VerifyEmailPage />);

      const otpInput = screen.getByLabelText("Mã xác minh");
      await userEvent.type(otpInput, "123456");

      const submitBtn = screen.getByRole("button", { name: "Xác minh" });
      expect(submitBtn.hasAttribute("disabled")).toBe(false);

      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockVerifySignupOtp).toHaveBeenCalledWith("test@dino.vn", "123456");
      });
    });

    it("displays error alert when verification fails", async () => {
      mockVerifySignupOtp.mockRejectedValueOnce(new Error("Mã OTP không chính xác hoặc đã hết hạn"));
      render(<VerifyEmailPage />);

      const otpInput = screen.getByLabelText("Mã xác minh");
      await userEvent.type(otpInput, "999999");
      await userEvent.click(screen.getByRole("button", { name: "Xác minh" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Mã OTP không chính xác hoặc đã hết hạn");
    });

    it("disables resend button during 60s countdown and re-enables when timer reaches zero", () => {
      vi.useFakeTimers();
      render(<VerifyEmailPage />);

      // Ban đầu: đang đếm ngược 60 giây
      const resendBtn = screen.getByRole("button", { name: /Gửi lại mã sau/ });
      expect(resendBtn.hasAttribute("disabled")).toBe(true);
      expect(resendBtn.textContent).toContain("Gửi lại mã sau 60 giây");

      // Cho trôi qua 60 giây (mỗi giây cần act riêng để React re-render và hook useEffect schedule timer kế tiếp)
      for (let i = 0; i < 60; i++) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      // Nút đã sẵn sàng gửi lại
      const enabledResendBtn = screen.getByRole("button", { name: "Gửi lại mã" });
      expect(enabledResendBtn.hasAttribute("disabled")).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("ForgotPasswordPage", () => {
    it("renders neutral response to prevent account enumeration even if user does not exist", async () => {
      mockResetPassword.mockRejectedValueOnce(new Error("User not found"));
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/Email/i);
      fireEvent.change(emailInput, { target: { value: "nonexistent@dino.vn" } });

      const submitBtn = screen.getByRole("button", { name: "Gửi hướng dẫn" });
      fireEvent.click(submitBtn);

      // Luôn phản hồi trung tính không phân biệt tài khoản tồn tại hay không
      await waitFor(() => {
        const statusNotice = screen.getByRole("status");
        expect(statusNotice.textContent).toBe("Nếu email tồn tại, thư hướng dẫn sẽ được gửi.");
      });
      expect(mockResetPassword).toHaveBeenCalledWith("nonexistent@dino.vn");
    });
  });

  describe("ResetPasswordPage", () => {
    it("validates 8-character minimum password requirement", async () => {
      render(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^Mật khẩu mới/i);
      const confirmInput = screen.getByLabelText(/^Xác nhận mật khẩu/i);
      fireEvent.change(passInput, { target: { value: "12345" } });
      fireEvent.change(confirmInput, { target: { value: "12345" } });

      const submitBtn = screen.getByRole("button", { name: "Cập nhật mật khẩu" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert.textContent).toBe("Mật khẩu cần ít nhất 8 ký tự.");
      });
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it("displays error alert when confirmation password does not match", async () => {
      render(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^Mật khẩu mới/i);
      const confirmInput = screen.getByLabelText(/^Xác nhận mật khẩu/i);
      fireEvent.change(passInput, { target: { value: "Password123!" } });
      fireEvent.change(confirmInput, { target: { value: "DifferentPass123!" } });

      const submitBtn = screen.getByRole("button", { name: "Cập nhật mật khẩu" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert.textContent).toBe("Mật khẩu xác nhận chưa khớp.");
      });
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it("submits new password when matching and >= 8 characters", async () => {
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      render(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^Mật khẩu mới/i);
      const confirmInput = screen.getByLabelText(/^Xác nhận mật khẩu/i);
      fireEvent.change(passInput, { target: { value: "SecurePass123!" } });
      fireEvent.change(confirmInput, { target: { value: "SecurePass123!" } });

      const submitBtn = screen.getByRole("button", { name: "Cập nhật mật khẩu" });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith("SecurePass123!");
      });
    });
  });
});
