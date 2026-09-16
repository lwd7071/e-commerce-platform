"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Users,
  Store,
  Package,
  FileText,
  Lock,
  Unlock,
  EyeOff,
  Eye,
  ArrowLeft,
  Search,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  status: "ACTIVE" | "LOCKED";
  createdAt: string;
}

interface PlatformShop {
  id: string;
  name: string;
  ownerEmail: string;
  productCount: number;
  status: "ACTIVE" | "LOCKED";
  createdAt: string;
}

interface ModerationProduct {
  id: string;
  name: string;
  shopName: string;
  price: number;
  status: "ACTIVE" | "HIDDEN";
  reports: number;
}

interface AdminLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string;
  time: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"users" | "shops" | "products" | "logs">("users");

  // Danh sách Người dùng (QLND)
  const [users, setUsers] = useState<UserAccount[]>([
    { id: "USR-001", email: "hainguyen@gmail.com", fullName: "Nguyễn Trung Hải", role: "BUYER", status: "ACTIVE", createdAt: "10/01/2026" },
    { id: "USR-002", email: "moristudio@gmail.com", fullName: "Lương Viết Vĩ Đông", role: "SELLER", status: "ACTIVE", createdAt: "15/01/2026" },
    { id: "USR-003", email: "baduser99@spam.com", fullName: "Spam Bot", role: "BUYER", status: "LOCKED", createdAt: "12/03/2026" },
    { id: "USR-004", email: "cuongnong@gmail.com", fullName: "Nông Văn Cường", role: "BUYER", status: "ACTIVE", createdAt: "05/02/2026" },
    { id: "USR-005", email: "anyenceramic@gmail.com", fullName: "Trần Đăng Thắng", role: "SELLER", status: "ACTIVE", createdAt: "20/01/2026" },
  ]);

  // Danh sách Gian hàng (QLS-A)
  const [shops, setShops] = useState<PlatformShop[]>([
    { id: "SHOP-001", name: "Mori Studio", ownerEmail: "moristudio@gmail.com", productCount: 18, status: "ACTIVE", createdAt: "15/01/2026" },
    { id: "SHOP-002", name: "An Yên Ceramic", ownerEmail: "anyenceramic@gmail.com", productCount: 12, status: "ACTIVE", createdAt: "20/01/2026" },
    { id: "SHOP-003", name: "Fake Watch Store", ownerEmail: "fakewatch@gmail.com", productCount: 5, status: "LOCKED", createdAt: "01/03/2026" },
    { id: "SHOP-004", name: "Minimal Living", ownerEmail: "minimalliving@gmail.com", productCount: 24, status: "ACTIVE", createdAt: "10/02/2026" },
  ]);

  // Kiểm duyệt sản phẩm (KDSP)
  const [modProducts, setModProducts] = useState<ModerationProduct[]>([
    { id: "PROD-01", name: "Áo sơ mi Linen dáng suông Minimalist", shopName: "Mori Studio", price: 289000, status: "ACTIVE", reports: 0 },
    { id: "PROD-02", name: "Đèn gốm Wabi-Sabi thủ công", shopName: "An Yên Ceramic", price: 420000, status: "ACTIVE", reports: 0 },
    { id: "PROD-03", name: "Nước hoa nhái thương hiệu nổi tiếng", shopName: "Fake Watch Store", price: 99000, status: "HIDDEN", reports: 8 },
    { id: "PROD-04", name: "Bình giữ nhiệt Inox Pastel", shopName: "Minimal Living", price: 245000, status: "ACTIVE", reports: 1 },
  ]);

  // Nhật ký quản trị (AdminLog - QD20)
  const [logs, setLogs] = useState<AdminLogItem[]>([
    { id: "LOG-01", action: "LOCK_USER", targetType: "USER", targetId: "USR-003", reason: "Spam đánh giá ảo đơn hàng", time: "16/09/2026 08:00" },
    { id: "LOG-02", action: "LOCK_SHOP", targetType: "SHOP", targetId: "SHOP-003", reason: "Bán hàng nhái, vi phạm quyền sở hữu trí tuệ", time: "15/09/2026 16:30" },
    { id: "LOG-03", action: "HIDE_PRODUCT", targetType: "PRODUCT", targetId: "PROD-03", reason: "Nội dung vi phạm chính sách sàn", time: "15/09/2026 16:35" },
  ]);

  const toggleUserLock = (user: UserAccount) => {
    const isLocking = user.status === "ACTIVE";
    let reason = "";
    if (isLocking) {
      reason = prompt("Nhập lý do khóa tài khoản (Bắt buộc theo QD17):") || "";
      if (!reason) return;
    }

    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: isLocking ? "LOCKED" : "ACTIVE" } : u));
    
    // Ghi nhật ký AdminLog
    setLogs(prev => [
      {
        id: "LOG-" + Date.now(),
        action: isLocking ? "LOCK_USER" : "UNLOCK_USER",
        targetType: "USER",
        targetId: user.id,
        reason: isLocking ? reason : "Mở khóa sau khi xác minh",
        time: new Date().toLocaleString("vi-VN"),
      },
      ...prev,
    ]);
  };

  const toggleShopLock = (shop: PlatformShop) => {
    const isLocking = shop.status === "ACTIVE";
    let reason = "";
    if (isLocking) {
      reason = prompt("Nhập lý do khóa gian hàng (Bắt buộc theo QD17):") || "";
      if (!reason) return;
    }

    setShops(prev => prev.map(s => s.id === shop.id ? { ...s, status: isLocking ? "LOCKED" : "ACTIVE" } : s));

    setLogs(prev => [
      {
        id: "LOG-" + Date.now(),
        action: isLocking ? "LOCK_SHOP" : "UNLOCK_SHOP",
        targetType: "SHOP",
        targetId: shop.id,
        reason: isLocking ? reason : "Mở khóa gian hàng",
        time: new Date().toLocaleString("vi-VN"),
      },
      ...prev,
    ]);
  };

  const toggleProductHide = (prod: ModerationProduct) => {
    const isHiding = prod.status === "ACTIVE";
    let reason = "";
    if (isHiding) {
      reason = prompt("Nhập lý do ẩn sản phẩm (Bắt buộc theo QD17):") || "";
      if (!reason) return;
    }

    setModProducts(prev => prev.map(p => p.id === prod.id ? { ...p, status: isHiding ? "HIDDEN" : "ACTIVE" } : p));

    setLogs(prev => [
      {
        id: "LOG-" + Date.now(),
        action: isHiding ? "HIDE_PRODUCT" : "RESTORE_PRODUCT",
        targetType: "PRODUCT",
        targetId: prod.id,
        reason: isHiding ? reason : "Khôi phục hiển thị sản phẩm",
        time: new Date().toLocaleString("vi-VN"),
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-stone-800 pb-20">
      {/* HEADER ADMIN */}
      <header className="bg-stone-900 text-white sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-full bg-stone-800 hover:bg-stone-700 flex items-center justify-center text-stone-300 transition-colors" title="Về trang mua sắm">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-sm">
                ✦
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold leading-none">Shopee Minimal Admin</h1>
                  <span className="bg-rose-500/20 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded-full border border-rose-500/30">
                    SUPERADMIN
                  </span>
                </div>
                <span className="text-[11px] text-stone-400">Hệ thống quản trị tập trung toàn sàn</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/seller" className="text-xs text-stone-300 hover:text-white px-3 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 transition-colors flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-orange-400" />
              Kênh Người Bán
            </Link>
            <Link href="/" className="text-xs text-orange-300 hover:text-orange-200 px-3 py-1.5 rounded-full border border-orange-400/30 transition-colors">
              Xem Storefront ↗
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 space-y-8">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>GMV Toàn Sàn (Hợp lệ)</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-2">84.500.000₫</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Tổng từ các đơn COMPLETED</p>
          </div>

          <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Tổng người dùng (QLND)</span>
              <Users className="w-4 h-4 text-stone-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-2">1.248</div>
            <p className="text-[11px] text-stone-400 mt-1">1.180 Buyer • 68 Seller</p>
          </div>

          <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Gian hàng đang mở (QLS-A)</span>
              <Store className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-2xl font-black text-stone-900 mt-2">52 Shop</div>
            <p className="text-[11px] text-stone-400 mt-1">49 Đang bán • 3 Bị khóa</p>
          </div>

          <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>Xử lý vi phạm (QD17)</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 mt-2">{logs.length} bản ghi</div>
            <p className="text-[11px] text-rose-500 mt-1">Có lưu lý do & audit log</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-3 border-b border-stone-200 pb-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-2 px-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "users" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            Quản lý tài khoản ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("shops")}
            className={`pb-2 px-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "shops" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            Quản lý gian hàng ({shops.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-2 px-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "products" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            Kiểm duyệt sản phẩm ({modProducts.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-2 px-3 text-sm font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "logs" ? "border-stone-900 text-stone-900" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            Nhật ký quản trị (AdminLog)
          </button>
        </div>

        {/* TAB 1: USERS (QLND) */}
        {activeTab === "users" && (
          <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Danh sách người dùng toàn sàn</h3>
              <p className="text-xs text-stone-500">Khóa tài khoản vi phạm và lưu lý do vào AdminLog theo QD03 & QD17</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Mã User</th>
                    <th className="py-3 px-4">Họ tên & Email</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Ngày tham gia</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{u.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-800">{u.fullName}</div>
                        <div className="text-[11px] text-stone-400">{u.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          u.role === "ADMIN" ? "bg-purple-100 text-purple-800" : u.role === "SELLER" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.status === "ACTIVE" ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">LOCKED</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-500">{u.createdAt}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleUserLock(u)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            u.status === "ACTIVE"
                              ? "text-rose-600 hover:bg-rose-50 border border-rose-200"
                              : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                          }`}
                        >
                          {u.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SHOPS (QLS-A) */}
        {activeTab === "shops" && (
          <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Quản lý gian hàng (Shop)</h3>
              <p className="text-xs text-stone-500">Kiểm soát hoạt động các shop trên sàn; khi shop bị khóa, sản phẩm sẽ tự ẩn</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Mã Shop</th>
                    <th className="py-3 px-4">Tên Shop</th>
                    <th className="py-3 px-4">Chủ shop (Owner)</th>
                    <th className="py-3 px-4">Số sản phẩm</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {shops.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{s.id}</td>
                      <td className="py-3 px-4 font-bold text-stone-800">{s.name}</td>
                      <td className="py-3 px-4 text-stone-600">{s.ownerEmail}</td>
                      <td className="py-3 px-4 font-semibold text-stone-800">{s.productCount} SP</td>
                      <td className="py-3 px-4">
                        {s.status === "ACTIVE" ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">LOCKED</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleShopLock(s)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            s.status === "ACTIVE"
                              ? "text-rose-600 hover:bg-rose-50 border border-rose-200"
                              : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                          }`}
                        >
                          {s.status === "ACTIVE" ? "Khóa shop" : "Mở shop"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRODUCTS (KDSP) */}
        {activeTab === "products" && (
          <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Kiểm duyệt sản phẩm (KDSP)</h3>
              <p className="text-xs text-stone-500">Ưu tiên chuyển trạng thái HIDDEN thay vì xóa vật lý theo QD16 để bảo toàn đơn hàng cũ</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Mã SP</th>
                    <th className="py-3 px-4">Tên sản phẩm</th>
                    <th className="py-3 px-4">Shop</th>
                    <th className="py-3 px-4">Báo cáo</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {modProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-stone-900">{p.id}</td>
                      <td className="py-3 px-4 font-bold text-stone-800">{p.name}</td>
                      <td className="py-3 px-4 text-stone-600">{p.shopName}</td>
                      <td className="py-3 px-4">
                        {p.reports > 0 ? (
                          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[11px]">{p.reports} vi phạm</span>
                        ) : (
                          <span className="text-stone-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.status === "ACTIVE" ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">HIỂN THỊ</span>
                        ) : (
                          <span className="bg-stone-200 text-stone-700 text-[10px] font-bold px-2 py-0.5 rounded-full">ĐÃ ẨN</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleProductHide(p)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                            p.status === "ACTIVE"
                              ? "text-rose-600 hover:bg-rose-50 border border-rose-200"
                              : "text-emerald-700 hover:bg-emerald-50 border border-emerald-200"
                          }`}
                        >
                          {p.status === "ACTIVE" ? "Ẩn sản phẩm" : "Hiện lại"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: ADMIN LOGS (QD20) */}
        {activeTab === "logs" && (
          <div className="bg-white border border-stone-200/80 rounded-3xl p-6 shadow-2xs space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">Nhật ký hoạt động quản trị (AdminLog & ModerationRecord)</h3>
              <p className="text-xs text-stone-500">Truy vết mọi thao tác khóa/mở khóa/ẩn sản phẩm theo QD20</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-4">Mã Log</th>
                    <th className="py-3 px-4">Hành động</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Lý do xử lý (QD17)</th>
                    <th className="py-3 px-4">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-mono">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-stone-900">{l.id}</td>
                      <td className="py-3 px-4">
                        <span className="bg-stone-100 text-stone-800 text-[10px] font-bold px-2 py-0.5 rounded">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-600 font-sans">{l.targetType}: {l.targetId}</td>
                      <td className="py-3 px-4 font-sans text-stone-800">{l.reason}</td>
                      <td className="py-3 px-4 text-stone-400 text-[11px] font-sans">{l.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
