"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { resolvePostLoginRedirect, sanitizeReturnTo } from "@/lib/auth/route-guards";
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const reason = searchParams.get("reason");

  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(() => {
    if (reason === "locked") {
      return "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.";
    }
    if (reason === "expired") {
      return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    try {
      await loginWithGoogle(returnTo);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không thể đăng nhập bằng Google.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login(email, password);
      const destination = resolvePostLoginRedirect(returnTo, loggedUser?.role);
      router.push(destination);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[var(--card)] sm:border sm:border-[var(--border)] sm:rounded-2xl sm:shadow-sm p-6 sm:p-8 flex flex-col justify-center flex-1 sm:flex-initial">
      {/* Nút quay lại trên Mobile */}
      <div className="flex items-center justify-between mb-4 sm:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--subtext)] hover:text-[var(--foreground)] py-1.5 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--background)] transition-colors"
          aria-label="Quay lại trang chủ"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Trang chủ</span>
        </Link>
      </div>

      <div className="text-center mb-6">
        <Link
          href="/"
          className="brand-lockup text-3xl font-extrabold tracking-tight mb-2 inline-flex items-center text-[var(--foreground)]"
          aria-label="Dino - trang chủ"
        >
          <span>Dino</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Đăng nhập tài khoản
        </h1>
        <p className="text-xs sm:text-sm text-[var(--subtext)] mt-1">
          Chào mừng bạn quay trở lại với Dino
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3 rounded-xl bg-[var(--danger-surface)] border border-[var(--danger-border)] flex items-start gap-2 text-sm text-[var(--danger-text)] font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5"
          >
            Địa chỉ Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full pl-10 pr-3 py-3 sm:py-2.5 h-12 sm:h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)]"
            >
              Mật khẩu
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-[var(--primary-active)] hover:underline py-1"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-10 pr-11 py-3 sm:py-2.5 h-12 sm:h-10 rounded-xl border border-[var(--border)] bg-[var(--background)] text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--subtext)] hover:text-[var(--foreground)] p-1.5 rounded-lg transition-colors"
              aria-label={showPassword ? "Ẩn mật mã" : "Hiện mật mã"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 sm:h-11 rounded-xl bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] font-semibold text-sm shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang xử lý...
            </>
          ) : (
            "Đăng nhập"
          )}
        </button>
      </form>

      {/* Dải phân cách */}
      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--border)]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[var(--card)] px-3 text-[var(--subtext)] font-medium">
            Hoặc tiếp tục với
          </span>
        </div>
      </div>

      {/* Nút đăng nhập Google với logo màu chuẩn */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full h-12 sm:h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] font-medium text-sm text-[var(--foreground)] hover:bg-[var(--card-muted)] transition-colors flex items-center justify-center gap-2.5 shadow-xs"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Đăng nhập với Google</span>
      </button>

      <div className="mt-6 text-center text-sm text-[var(--subtext)]">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="font-semibold text-[var(--primary-active)] hover:underline"
        >
          Đăng ký ngay
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-0 sm:p-4 bg-[var(--background)]">
      <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--subtext)]">Đang tải biểu mẫu...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
