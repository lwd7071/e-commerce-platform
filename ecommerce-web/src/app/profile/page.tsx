"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  User, 
  MapPin, 
  Lock, 
  Plus, 
  LogOut
} from "lucide-react";

interface Address {
  id: string;
  fullName: string;
  phone: string;
  street: string;
  ward: string;
  district: string;
  city: string;
  isDefault: boolean;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<"profile" | "addresses" | "security">("profile");

  const [userInfo, setUserInfo] = useState({
    fullName: "Nguyễn Trung Hải",
    email: "hainguyen@gmail.com",
    phone: "0912 345 678",
    role: "Khách hàng Mori",
    joinDate: "10/01/2026",
  });

  const [addresses, setAddresses] = useState<Address[]>([
    {
      id: "addr-1",
      fullName: "Nguyễn Trung Hải",
      phone: "0912 345 678",
      street: "Số 1 Võ Văn Ngân",
      ward: "Phường Linh Chiểu",
      district: "TP. Thủ Đức",
      city: "TP. Hồ Chí Minh",
      isDefault: true,
    },
    {
      id: "addr-2",
      fullName: "Nguyễn Trung Hải (Văn phòng)",
      phone: "0912 345 678",
      street: "Tòa nhà Bitexco, 2 Hải Triều",
      ward: "Phường Bến Nghé",
      district: "Quận 1",
      city: "TP. Hồ Chí Minh",
      isDefault: false,
    },
  ]);

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const setDefaultAddress = (id: string) => {
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
  };

  return (
    <div className="min-h-screen bg-[#FBF8F9] pb-24 text-[#221C1F]">
      {/* Header */}
      <header className="bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[#F2E8EC] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl text-[#7E7077] hover:bg-[#FFF0F6] hover:text-[#FF7AAC] transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/" className="text-xl font-bold tracking-tight text-[#221C1F] mr-2">
              Mori<span className="text-[#FF7AAC]">.</span>
            </Link>
            <h1 className="text-xs font-semibold text-[#7E7077] pl-3 border-l border-[#F2E8EC]">
              Tài khoản của tôi
            </h1>
          </div>
          <Link href="/login" className="flex items-center gap-1.5 text-xs font-semibold text-[#7E7077] hover:text-[#DC2626] transition-colors">
            <LogOut className="w-4 h-4" /> Đăng xuất
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar Menu */}
          <div className="md:col-span-1 space-y-3">
            <div className="matte-card p-5 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] font-bold flex items-center justify-center text-base shrink-0">
                H
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-[#221C1F] truncate">{userInfo.fullName}</h3>
                <p className="text-[11px] text-[#7E7077] truncate">{userInfo.email}</p>
              </div>
            </div>

            <nav className="matte-card p-2 space-y-1">
              <button
                onClick={() => setActiveTab("profile")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "profile"
                    ? "bg-[#FFF0F6] text-[#FF7AAC]"
                    : "text-[#7E7077] hover:bg-[#FAF6F8]"
                }`}
              >
                <User className="w-4 h-4" /> Hồ sơ cá nhân
              </button>

              <button
                onClick={() => setActiveTab("addresses")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "addresses"
                    ? "bg-[#FFF0F6] text-[#FF7AAC]"
                    : "text-[#7E7077] hover:bg-[#FAF6F8]"
                }`}
              >
                <MapPin className="w-4 h-4" /> Sổ địa chỉ ({addresses.length})
              </button>

              <button
                onClick={() => setActiveTab("security")}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === "security"
                    ? "bg-[#FFF0F6] text-[#FF7AAC]"
                    : "text-[#7E7077] hover:bg-[#FAF6F8]"
                }`}
              >
                <Lock className="w-4 h-4" /> Đổi mật khẩu
              </button>
            </nav>
          </div>

          {/* Content Area */}
          <div className="md:col-span-3">
            {/* Tab 1: Hồ sơ */}
            {activeTab === "profile" && (
              <div className="matte-card p-6 sm:p-8">
                <h2 className="text-base font-bold text-[#221C1F] mb-1">Hồ sơ cá nhân</h2>
                <p className="text-xs text-[#7E7077] mb-6">Quản lý thông tin tài khoản Mori để bảo mật và đặt hàng thuận tiện</p>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Họ và tên</label>
                    <input
                      type="text"
                      value={userInfo.fullName}
                      onChange={e => setUserInfo({ ...userInfo, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] font-semibold bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Địa chỉ Email</label>
                    <input
                      type="email"
                      disabled
                      value={userInfo.email}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#7E7077] bg-gray-100/60 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Số điện thoại</label>
                    <input
                      type="tel"
                      value={userInfo.phone}
                      onChange={e => setUserInfo({ ...userInfo, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    {isSaved && <span className="text-xs text-[#059669] font-semibold">✓ Đã lưu thay đổi thành công!</span>}
                    <button
                      type="submit"
                      className="btn-matte-primary ml-auto px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Lưu thay đổi
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: Sổ địa chỉ */}
            {activeTab === "addresses" && (
              <div className="matte-card p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-[#F2E8EC] pb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#221C1F]">Sổ địa chỉ nhận hàng</h2>
                    <p className="text-xs text-[#7E7077]">Danh sách địa chỉ giao hàng đã lưu</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert("Thêm địa chỉ mới")}
                    className="btn-matte-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Thêm địa chỉ mới
                  </button>
                </div>

                <div className="space-y-3 pt-2">
                  {addresses.map(addr => (
                    <div key={addr.id} className="p-4 rounded-xl border border-[#F2E8EC] bg-[#FAF6F8] flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#221C1F]">{addr.fullName}</span>
                          <span className="text-xs text-[#7E7077]">• {addr.phone}</span>
                          {addr.isDefault && (
                            <span className="bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3] text-[10px] font-semibold px-2 py-0.5 rounded-md">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#7E7077]">
                          {addr.street}, {addr.ward}, {addr.district}, {addr.city}
                        </p>
                      </div>

                      {!addr.isDefault && (
                        <button
                          onClick={() => setDefaultAddress(addr.id)}
                          className="text-xs text-[#FF7AAC] font-semibold hover:underline"
                        >
                          Thiết lập mặc định
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: Bảo mật */}
            {activeTab === "security" && (
              <div className="matte-card p-6 sm:p-8">
                <h2 className="text-base font-bold text-[#221C1F] mb-1">Đổi mật khẩu</h2>
                <p className="text-xs text-[#7E7077] mb-6">Để bảo mật tài khoản, vui lòng không chia sẻ mật khẩu cho người khác</p>

                <form onSubmit={e => { e.preventDefault(); alert("Đổi mật khẩu thành công"); }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Mật khẩu hiện tại</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#221C1F] uppercase tracking-wider mb-1.5">Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#F2E8EC] text-xs text-[#221C1F] bg-[#FAF6F8] focus:border-[#FF7AAC] outline-hidden"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="btn-matte-primary px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cập nhật mật khẩu
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
