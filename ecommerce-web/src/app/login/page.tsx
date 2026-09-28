"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      router.push("/");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-[#221C1F]">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block text-3xl font-bold text-[#221C1F] tracking-tight hover:opacity-90 transition-opacity">
          Mori<span className="text-[#FF7AAC]">.</span>
        </Link>
        <h1 className="mt-2 text-lg font-bold text-[#221C1F] tracking-tight">
          Đăng nhập tài khoản
        </h1>
        <p className="mt-1 text-xs text-[#7E7077]">
          Chưa có tài khoản Mori?{" "}
          <Link href="/register" className="font-semibold text-[#FF7AAC] hover:underline underline-offset-4">
            Đăng ký tài khoản mới
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="matte-card py-8 px-6 sm:px-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">
                Địa chỉ Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E7077]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider">
                  Mật khẩu
                </label>
                <a href="#" className="text-xs text-[#FF7AAC] font-medium hover:underline">
                  Quên mật khẩu?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E7077]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-[#7E7077] cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#F2E8EC] text-[#FF7AAC] focus:ring-[#FF7AAC] accent-[#FF7AAC]"
                />
                Ghi nhớ đăng nhập
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-matte-primary w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? "Đang xử lý..." : "Đăng nhập ngay"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-xs text-[#7E7077] hover:text-[#221C1F] transition-colors">
            ← Quay lại trang chủ mua sắm Mori
          </Link>
        </div>
      </div>
    </div>
  );
}
