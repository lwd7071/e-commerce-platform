"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import type { UserRole } from "@/lib/auth/types";
import { Lock, Mail, AlertCircle, Loader2, Store, User } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("BUYER");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (fullName.trim().length < 2 || (role === "SELLER" && shopName.trim().length < 2)) {
      setErrorMsg("Vui lòng nhập họ tên và tên gian hàng hợp lệ.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Mật khẩu phải có độ dài tối thiểu 8 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email, password, role, fullName, shopName);
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng ký thất bại. Vui lòng thử lại.";
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startGoogle = async () => {
    setErrorMsg(null);
    sessionStorage.setItem("dino_signup_draft", JSON.stringify({ email, full_name: fullName.trim(), requested_role: role, shop_name: role === "SELLER" ? shopName.trim() : null }));
    try { await loginWithGoogle("/"); }
    catch (err) { setErrorMsg(err instanceof Error ? err.message : "Không thể đăng nhập bằng Google."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--background)]">
      <div className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="text-center mb-6">
          <Link href="/" className="brand-lockup text-3xl font-extrabold tracking-tight mb-3 inline-flex items-center text-[var(--foreground)]" aria-label="Dino - trang chủ">
            <span>Dino</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Tạo tài khoản mới
          </h1>
          <p className="text-sm text-[var(--subtext)] mt-1">
            Gia nhập cộng đồng mua sắm Dino ngay hôm nay
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
            <label htmlFor="reg-full-name" className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5">Họ và tên</label>
            <input id="reg-full-name" value={fullName} onChange={e => setFullName(e.target.value)} required minLength={2} maxLength={150} className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm" />
          </div>
          {role === "SELLER" && <div>
            <label htmlFor="reg-shop-name" className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5">Tên gian hàng</label>
            <input id="reg-shop-name" value={shopName} onChange={e => setShopName(e.target.value)} required minLength={2} maxLength={150} className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm" />
          </div>}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-2">
              Bạn muốn tham gia với vai trò:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("BUYER")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                  role === "BUYER"
                    ? "border-[var(--primary)] bg-[var(--primary-surface)] text-[var(--primary-active)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--subtext)] hover:bg-[var(--card-muted)]"
                }`}
              >
                <User className="w-5 h-5" />
                Người Mua Hàng
              </button>

              <button
                type="button"
                onClick={() => setRole("SELLER")}
                className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-xs font-semibold ${
                  role === "SELLER"
                    ? "border-[var(--primary)] bg-[var(--primary-surface)] text-[var(--primary-active)]"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--subtext)] hover:bg-[var(--card-muted)]"
                }`}
              >
                <Store className="w-5 h-5" />
                Nhà Bán Hàng
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-email"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5"
            >
              Địa chỉ Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
              <input
                id="reg-email"
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
            <label
              htmlFor="reg-password"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5"
            >
              Mật khẩu (tối thiểu 8 ký tự)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="reg-confirm"
              className="block text-xs font-semibold uppercase tracking-wider text-[var(--foreground)] mb-1.5"
            >
              Xác nhận mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtext)]" />
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)] font-semibold text-sm shadow-sm hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tạo tài khoản...
              </>
            ) : (
              "Đăng ký tài khoản"
            )}
          </button>
        </form>

        <button type="button" onClick={startGoogle} className="w-full mt-3 py-3 rounded-xl border border-[var(--border)] font-semibold text-sm hover:bg-[var(--card-muted)]">Tiếp tục với Google</button>

        <div className="mt-6 text-center text-sm text-[var(--subtext)]">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-semibold text-[var(--primary-active)] hover:underline"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
}
