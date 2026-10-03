"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Phone, Store, ShoppingBag, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"BUYER" | "SELLER">("BUYER");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (role === "SELLER") router.push("/seller");
      else router.push("/");
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-[#221C1F]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block text-3xl font-bold text-[#221C1F] tracking-tight hover:opacity-90 transition-opacity">
          Mori<span className="text-[#FF7AAC]">.</span>
        </Link>
        <h1 className="mt-2 text-lg font-bold text-[#221C1F] tracking-tight">
          Tạo tài khoản mới
        </h1>
        <p className="mt-1 text-xs text-[#7E7077]">
          Đã có tài khoản Mori?{" "}
          <Link href="/login" className="font-semibold text-[#FF7AAC] hover:underline underline-offset-4">
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="matte-card py-8 px-6 sm:px-8">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Lựa chọn loại tài khoản */}
            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-2">
                Mục đích sử dụng tài khoản
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("BUYER")}
                  className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    role === "BUYER"
                      ? "border-[#FF7AAC] bg-[#FFF0F6] text-[#FF7AAC] font-bold"
                      : "border-[#F2E8EC] bg-[#FAF6F8] text-[#7E7077] hover:bg-[#FFF0F6]"
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 mb-1 text-[#FF7AAC]" />
                  <span className="text-xs">Mua sắm (Buyer)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("SELLER")}
                  className={`flex flex-col items-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    role === "SELLER"
                      ? "border-[#FF7AAC] bg-[#FFF0F6] text-[#FF7AAC] font-bold"
                      : "border-[#F2E8EC] bg-[#FAF6F8] text-[#7E7077] hover:bg-[#FFF0F6]"
                  }`}
                >
                  <Store className="w-5 h-5 mb-1 text-[#FF7AAC]" />
                  <span className="text-xs">Mở shop (Seller)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1">Họ và tên</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E7077]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1">Địa chỉ Email</label>
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
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1">Số điện thoại</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E7077]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912 345 678"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1">Mật khẩu</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#7E7077]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#7E7077] leading-relaxed pt-1">
              Bằng việc đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của Mori.
            </p>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-matte-primary w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-70 cursor-pointer"
            >
              {isLoading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
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
