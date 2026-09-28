"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { sanitizeReturnTo } from "@/lib/auth/route-guards";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push(returnTo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="text-center mb-6">
        <Link href="/" className="inline-block mb-3 hover:opacity-90 transition-opacity">
          <span className="text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            Dino<span className="text-[var(--primary-active)]">.</span>
          </span>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Đăng nhập tài khoản
        </h1>
        <p className="text-sm text-[var(--subtext)] mt-1">
          Chào mừng bạn quay trở lại với Dino
        </p>
      </div>

      {errorMsg && (
        <div className="mb-5 p-3 rounded-xl bg-[var(--danger-surface)] border border-[var(--danger-border)] flex items-start gap-2 text-sm text-[var(--danger)]">
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
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
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
              className="text-xs text-[var(--primary-active)] hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] font-semibold text-sm shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <Suspense fallback={<div className="p-8 text-center text-sm text-[var(--subtext)]">Đang tải biểu mẫu...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
