// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
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

  describe("VerifyEmailPage (OTP flow)", () => {
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
  });

  describe("ForgotPasswordPage", () => {
    it("renders email input and sends reset link", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      render(<ForgotPasswordPage />);

      const emailInput = screen.getByLabelText(/Email/i);
      await userEvent.clear(emailInput);
      await userEvent.type(emailInput, "user@dino.vn");

      const submitBtn = screen.getByRole("button", { name: "Gửi hướng dẫn" });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith("user@dino.vn");
      });
    });
  });

  describe("ResetPasswordPage", () => {
    it("validates 8-character minimum password requirement", async () => {
      render(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^Mật khẩu mới/i);
      const confirmInput = screen.getByLabelText(/^Xác nhận mật khẩu/i);
      await userEvent.type(passInput, "12345");
      await userEvent.type(confirmInput, "12345");

      const form = passInput.closest("form")!;
      await waitFor(() => {
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Mật khẩu cần ít nhất 8 ký tự.");
      expect(mockUpdatePassword).not.toHaveBeenCalled();
    });

    it("submits new password when matching and >= 8 characters", async () => {
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      render(<ResetPasswordPage />);

      const passInput = screen.getByLabelText(/^Mật khẩu mới/i);
      const confirmInput = screen.getByLabelText(/^Xác nhận mật khẩu/i);
      await userEvent.type(passInput, "SecurePass123!");
      await userEvent.type(confirmInput, "SecurePass123!");

      const submitBtn = screen.getByRole("button", { name: "Cập nhật mật khẩu" });
      await userEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith("SecurePass123!");
      });
    });
  });
});
