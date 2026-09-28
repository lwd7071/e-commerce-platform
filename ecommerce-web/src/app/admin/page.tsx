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

  // Danh sách Người dùng
  const [users, setUsers] = useState<UserAccount[]>([
    { id: "USR-001", email: "hainguyen@gmail.com", fullName: "Nguyễn Trung Hải", role: "BUYER", status: "ACTIVE", createdAt: "10/01/2026" },
    { id: "USR-002", email: "moristudio@gmail.com", fullName: "Lương Viết Vĩ Đông", role: "SELLER", status: "ACTIVE", createdAt: "15/01/2026" },
    { id: "USR-003", email: "baduser99@spam.com", fullName: "Spam Bot", role: "BUYER", status: "LOCKED", createdAt: "12/03/2026" },
    { id: "USR-004", email: "cuongnong@gmail.com", fullName: "Nông Văn Cường", role: "BUYER", status: "ACTIVE", createdAt: "05/02/2026" },
    { id: "USR-005", email: "anyenceramic@gmail.com", fullName: "Trần Đăng Thắng", role: "SELLER", status: "ACTIVE", createdAt: "20/01/2026" },
  ]);

  // Danh sách Gian hàng
  const [shops, setShops] = useState<PlatformShop[]>([
    { id: "SHOP-001", name: "Mori Studio", ownerEmail: "moristudio@gmail.com", productCount: 18, status: "ACTIVE", createdAt: "15/01/2026" },
    { id: "SHOP-002", name: "An Yên Ceramic", ownerEmail: "anyenceramic@gmail.com", productCount: 12, status: "ACTIVE", createdAt: "20/01/2026" },
    { id: "SHOP-003", name: "Fake Watch Store", ownerEmail: "fakewatch@gmail.com", productCount: 5, status: "LOCKED", createdAt: "01/03/2026" },
    { id: "SHOP-004", name: "Minimal Living", ownerEmail: "minimalliving@gmail.com", productCount: 24, status: "ACTIVE", createdAt: "10/02/2026" },
  ]);

  // Kiểm duyệt sản phẩm
  const [modProducts, setModProducts] = useState<ModerationProduct[]>([
    { id: "PROD-01", name: "Áo sơ mi Linen dáng suông Minimalist", shopName: "Mori Studio", price: 289000, status: "ACTIVE", reports: 0 },
    { id: "PROD-02", name: "Đèn gốm Wabi-Sabi thủ công", shopName: "An Yên Ceramic", price: 420000, status: "ACTIVE", reports: 0 },
    { id: "PROD-03", name: "Nước hoa nhái thương hiệu nổi tiếng", shopName: "Fake Watch Store", price: 99000, status: "HIDDEN", reports: 8 },
    { id: "PROD-04", name: "Bình giữ nhiệt Inox Pastel", shopName: "Minimal Living", price: 245000, status: "ACTIVE", reports: 1 },
  ]);

  // Nhật ký quản trị
  const [logs, setLogs] = useState<AdminLogItem[]>([
    { id: "LOG-01", action: "LOCK_USER", targetType: "USER", targetId: "USR-003", reason: "Spam đánh giá ảo đơn hàng", time: "16/09/2026 08:00" },
    { id: "LOG-02", action: "LOCK_SHOP", targetType: "SHOP", targetId: "SHOP-003", reason: "Bán hàng nhái, vi phạm quyền sở hữu trí tuệ", time: "15/09/2026 16:30" },
    { id: "LOG-03", action: "HIDE_PRODUCT", targetType: "PRODUCT", targetId: "PROD-03", reason: "Nội dung vi phạm chính sách sàn", time: "15/09/2026 16:35" },
  ]);

  const toggleUserLock = (user: UserAccount) => {
    const isLocking = user.status === "ACTIVE";
    let reason = "";
    if (isLocking) {
      reason = prompt("Nhập lý do khóa tài khoản:") || "";
      if (!reason) return;
    }

    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: isLocking ? "LOCKED" : "ACTIVE" } : u));
    
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
      reason = prompt("Nhập lý do khóa gian hàng:") || "";
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
      reason = prompt("Nhập lý do ẩn sản phẩm:") || "";
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
    <div className="min-h-screen bg-[#FBF8F9] text-[#221C1F] pb-20">
      {/* HEADER ADMIN */}
      <header className="bg-[#221C1F] text-white sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 transition-colors" title="Về trang mua sắm">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white tracking-tight">
                Mori<span className="text-[#FF7AAC]">.</span>
              </span>
              <div className="pl-3 border-l border-white/20">
                <div className="flex items-center gap-2">
                  <h1 className="text-xs font-bold leading-none text-white">Mori Admin Portal</h1>
                  <span className="bg-[#FF7AAC]/20 text-[#FF7AAC] text-[10px] font-mono px-2 py-0.5 rounded-full border border-[#FF7AAC]/40 font-semibold">
                    SUPERADMIN
                  </span>
                </div>
                <span className="text-[11px] text-white/60">Hệ thống quản trị tập trung toàn sàn Mori</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/seller" className="text-xs text-white/80 hover:text-white px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5 font-medium">
              <Store className="w-3.5 h-3.5 text-[#FF7AAC]" />
              Kênh Người Bán
            </Link>
            <Link href="/" className="btn-matte-primary text-xs !py-2 !px-3.5">
              Xem Storefront ↗
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 mt-8 space-y-6">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>GMV Toàn Sàn</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-[#221C1F] mt-2">84.500.000₫</div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Từ các đơn hoàn tất</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Tổng người dùng</span>
              <Users className="w-4 h-4 text-[#7E7077]" />
            </div>
            <div className="text-xl font-bold text-[#221C1F] mt-2">1.248</div>
            <p className="text-[11px] text-[#7E7077] mt-1">1.180 Buyer • 68 Seller</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Gian hàng đang mở</span>
              <Store className="w-4 h-4 text-[#FF7AAC]" />
            </div>
            <div className="text-xl font-bold text-[#221C1F] mt-2">52 Shop</div>
            <p className="text-[11px] text-[#7E7077] mt-1">49 Đang bán • 3 Bị khóa</p>
          </div>

          <div className="matte-card p-5">
            <div className="flex items-center justify-between text-xs text-[#7E7077]">
              <span>Xử lý vi phạm</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-rose-600 mt-2">{logs.length} bản ghi</div>
            <p className="text-[11px] text-rose-500 mt-1">Có lưu lý do & audit log</p>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-3 border-b border-[#F2E8EC] pb-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "users" ? "border-[#FF7AAC] text-[#FF7AAC]" : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Quản lý tài khoản ({users.length})
          </button>
          <button
            onClick={() => setActiveTab("shops")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "shops" ? "border-[#FF7AAC] text-[#FF7AAC]" : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Quản lý gian hàng ({shops.length})
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "products" ? "border-[#FF7AAC] text-[#FF7AAC]" : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Kiểm duyệt sản phẩm ({modProducts.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "logs" ? "border-[#FF7AAC] text-[#FF7AAC]" : "border-transparent text-[#7E7077] hover:text-[#221C1F]"
            }`}
          >
            Nhật ký quản trị (AdminLog)
          </button>

          <Link
            href="/admin/categories"
            className="ml-auto mb-1.5 btn-action-primary"
          >
            <span>Quản lý danh mục →</span>
          </Link>
        </div>

        {/* TAB 1: USERS */}
        {activeTab === "users" && (
          <div className="matte-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#221C1F]">Danh sách người dùng toàn sàn</h3>
              <p className="text-xs text-[#7E7077]">Khóa tài khoản vi phạm và lưu lý do vào AdminLog</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Mã User</th>
                    <th className="py-3 px-4">Họ tên & Email</th>
                    <th className="py-3 px-4">Vai trò</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Ngày tham gia</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#221C1F]">{u.id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#221C1F]">{u.fullName}</div>
                        <div className="text-[11px] text-[#7E7077]">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                          u.role === "ADMIN" ? "bg-purple-50 text-purple-700 border border-purple-200" : u.role === "SELLER" ? "bg-[#FFF0F6] text-[#FF7AAC] border border-[#FFD1E3]" : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.status === "ACTIVE" ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">LOCKED</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#7E7077]">{u.createdAt}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => toggleUserLock(u)}
                          className={u.status === "ACTIVE" ? "btn-action-danger" : "btn-action-success"}
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

        {/* TAB 2: SHOPS */}
        {activeTab === "shops" && (
          <div className="matte-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#221C1F]">Quản lý gian hàng (Shop)</h3>
              <p className="text-xs text-[#7E7077]">Kiểm soát hoạt động các shop trên sàn; khi shop bị khóa, sản phẩm sẽ tự ẩn</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Mã Shop</th>
                    <th className="py-3 px-4">Tên Shop</th>
                    <th className="py-3 px-4">Chủ shop (Owner)</th>
                    <th className="py-3 px-4">Số sản phẩm</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC]">
                  {shops.map((s) => (
                    <tr key={s.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#221C1F]">{s.id}</td>
                      <td className="py-3 px-4 font-semibold text-[#221C1F]">{s.name}</td>
                      <td className="py-3 px-4 text-[#7E7077]">{s.ownerEmail}</td>
                      <td className="py-3 px-4 font-semibold text-[#221C1F]">{s.productCount} SP</td>
                      <td className="py-3 px-4">
                        {s.status === "ACTIVE" ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">ACTIVE</span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">LOCKED</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleShopLock(s)}
                          className={s.status === "ACTIVE" ? "btn-action-danger" : "btn-action-success"}
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

        {/* TAB 3: PRODUCTS */}
        {activeTab === "products" && (
          <div className="matte-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#221C1F]">Kiểm duyệt sản phẩm</h3>
              <p className="text-xs text-[#7E7077]">Chuyển trạng thái HIDDEN để ẩn sản phẩm vi phạm</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Mã SP</th>
                    <th className="py-3 px-4">Tên sản phẩm</th>
                    <th className="py-3 px-4">Shop</th>
                    <th className="py-3 px-4">Báo cáo</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC]">
                  {modProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#221C1F]">{p.id}</td>
                      <td className="py-3 px-4 font-semibold text-[#221C1F]">{p.name}</td>
                      <td className="py-3 px-4 text-[#7E7077]">{p.shopName}</td>
                      <td className="py-3 px-4">
                        {p.reports > 0 ? (
                          <span className="text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-2 py-0.5 rounded text-[11px]">{p.reports} vi phạm</span>
                        ) : (
                          <span className="text-[#7E7077]">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {p.status === "ACTIVE" ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">HIỂN THỊ</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-700 border border-gray-200 text-[10px] font-semibold px-2 py-0.5 rounded-full">ĐÃ ẨN</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => toggleProductHide(p)}
                          className={p.status === "ACTIVE" ? "btn-action-danger" : "btn-action-success"}
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

        {/* TAB 4: ADMIN LOGS */}
        {activeTab === "logs" && (
          <div className="matte-card p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[#221C1F]">Nhật ký hoạt động quản trị (AdminLog)</h3>
              <p className="text-xs text-[#7E7077]">Truy vết mọi thao tác khóa/mở khóa/ẩn sản phẩm</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#221C1F]">
                <thead className="bg-[#FAF6F8] text-[#7E7077] uppercase tracking-wider text-[10px] border-y border-[#F2E8EC]">
                  <tr>
                    <th className="py-3 px-4">Mã Log</th>
                    <th className="py-3 px-4">Hành động</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Lý do xử lý</th>
                    <th className="py-3 px-4">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E8EC] font-mono">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-[#FAF6F8] transition-colors">
                      <td className="py-3 px-4 font-bold text-[#221C1F]">{l.id}</td>
                      <td className="py-3 px-4">
                        <span className="bg-[#FFF0F6] text-[#FF7AAC] text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[#FFD1E3]">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#7E7077] font-sans">{l.targetType}: {l.targetId}</td>
                      <td className="py-3 px-4 font-sans text-[#221C1F]">{l.reason}</td>
                      <td className="py-3 px-4 text-[#7E7077] text-[11px] font-sans">{l.time}</td>
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
