"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextArea, TextInput } from "@/components/ui/form-controls";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/data-states";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { adminRepository } from "./admin.repository";
import type {
  UserAccount,
  PlatformShop,
  ModerationProduct,
  AdminAuditLog,
  DashboardStats,
} from "./admin.types";

type AdminTab = "users" | "shops" | "products" | "logs";

export function AdminDashboardScreen() {
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab Data
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [shops, setShops] = useState<PlatformShop[]>([]);
  const [products, setProducts] = useState<ModerationProduct[]>([]);
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Lock/Unlock User Modal State (A-705)
  const [lockingUser, setLockingUser] = useState<UserAccount | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [lockError, setLockError] = useState<string | null>(null);
  const [isSubmittingLock, setIsSubmittingLock] = useState(false);

  // Lock/Unlock Shop Modal State
  const [lockingShop, setLockingShop] = useState<PlatformShop | null>(null);
  const [shopLockReason, setShopLockReason] = useState("");
  const [shopLockError, setShopLockError] = useState<string | null>(null);
  const [isSubmittingShopLock, setIsSubmittingShopLock] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, usersData, shopsData, prodsData, logsData] = await Promise.all([
        adminRepository.getDashboardStats(),
        adminRepository.getUsers(),
        adminRepository.getShops(),
        adminRepository.getModerationProducts(),
        adminRepository.getAuditLogs(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setShops(shopsData);
      setProducts(prodsData);
      setLogs(logsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu quản trị sàn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // User Lock/Unlock Actions (A-705)
  const handleConfirmLockUser = async () => {
    if (!lockingUser) return;
    if (!lockReason.trim()) {
      setLockError("Vui lòng nhập lý do khóa tài khoản.");
      return;
    }

    setIsSubmittingLock(true);
    setLockError(null);
    try {
      const updated = await adminRepository.lockUser(lockingUser.id, lockReason);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const freshLogs = await adminRepository.getAuditLogs();
      setLogs(freshLogs);
      showToast(`Đã khóa tài khoản ${updated.email}`);
      setLockingUser(null);
      setLockReason("");
    } catch (err: unknown) {
      setLockError(err instanceof Error ? err.message : "Khóa tài khoản thất bại.");
    } finally {
      setIsSubmittingLock(false);
    }
  };

  const handleUnlockUser = async (user: UserAccount) => {
    try {
      const updated = await adminRepository.unlockUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      const freshLogs = await adminRepository.getAuditLogs();
      setLogs(freshLogs);
      showToast(`Đã mở khóa tài khoản ${updated.email}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Mở khóa thất bại.", "error");
    }
  };

  // Shop Lock/Unlock Actions
  const handleConfirmLockShop = async () => {
    if (!lockingShop) return;
    if (!shopLockReason.trim()) {
      setShopLockError("Vui lòng nhập lý do khóa gian hàng.");
      return;
    }

    setIsSubmittingShopLock(true);
    setShopLockError(null);
    try {
      const updated = await adminRepository.lockShop(lockingShop.id, shopLockReason);
      setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      const freshLogs = await adminRepository.getAuditLogs();
      setLogs(freshLogs);
      showToast(`Đã khóa gian hàng ${updated.name}`);
      setLockingShop(null);
      setShopLockReason("");
    } catch (err: unknown) {
      setShopLockError(err instanceof Error ? err.message : "Khóa gian hàng thất bại.");
    } finally {
      setIsSubmittingShopLock(false);
    }
  };

  const handleUnlockShop = async (shop: PlatformShop) => {
    try {
      const updated = await adminRepository.unlockShop(shop.id);
      setShops((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      const freshLogs = await adminRepository.getAuditLogs();
      setLogs(freshLogs);
      showToast(`Đã mở khóa gian hàng ${updated.name}`);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Mở khóa gian hàng thất bại.", "error");
    }
  };

  // Product Moderation Actions
  const handleToggleProductStatus = async (product: ModerationProduct) => {
    const targetStatus = product.status === "ACTIVE" ? "HIDDEN" : "ACTIVE";
    try {
      const updated = await adminRepository.moderateProduct(
        product.id,
        targetStatus,
        targetStatus === "HIDDEN" ? "Ẩn theo yêu cầu kiểm duyệt" : "Mở lại hiển thị sản phẩm"
      );
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      const freshLogs = await adminRepository.getAuditLogs();
      setLogs(freshLogs);
      showToast(
        targetStatus === "HIDDEN"
          ? `Đã ẩn sản phẩm "${product.name}"`
          : `Đã khôi phục sản phẩm "${product.name}"`
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Cập nhật sản phẩm thất bại.", "error");
    }
  };

  // Filtered queries
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredShops = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shopName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <ProtectedPage allowedRoles={["ADMIN"]}>
      <div className="admin-page space-y-6 pb-24">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-[var(--success-surface)] text-[var(--success)] border-[var(--success-border)]"
                : "bg-[var(--danger-surface)] text-[var(--danger)] border-[var(--danger-border)]"
            }`}
          >
            <Icon name={toast.type === "success" ? "check" : "warning"} className="w-4 h-4 shrink-0" />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Header */}
        <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Dino Control Center</p>
            <h1 className="page-title">Bảng điều khiển quản trị sàn (A-704)</h1>
            <p className="page-description">
              Giám sát số liệu kinh doanh, kiểm duyệt tài khoản, gian hàng và quản lý danh mục toàn diện.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin/categories"
              className="button button--secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
            >
              <Icon name="grid" className="w-4 h-4" />
              <span>Quản lý danh mục (A-709)</span>
            </Link>
          </div>
        </header>

        {/* Runtime Gated Notice (GAP-08) */}
        <div className="notice notice--info" role="status">
          <Icon name="info" />
          <div className="text-xs">
            <strong className="block font-semibold">Chế độ quản trị Dino Admin (A-704, A-705, Q-805)</strong>
            <span>
              Mọi thao tác khóa tài khoản, khóa gian hàng và kiểm duyệt đều yêu cầu lý do bắt buộc và được ghi lại đầy đủ vào Nhật ký kiểm duyệt (Audit Logs).
            </span>
          </div>
        </div>

        {/* Quick KPI Overview Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
            <Skeleton height={80} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="surface-card p-4">
              <span className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider block">
                Tổng Người dùng
              </span>
              <strong className="text-2xl font-bold text-[var(--foreground)] mt-1 block tabular-nums">
                {stats?.totalUsers || 0}
              </strong>
            </div>

            <div className="surface-card p-4">
              <span className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider block">
                Gian hàng hoạt động
              </span>
              <strong className="text-2xl font-bold text-[var(--primary-active)] mt-1 block tabular-nums">
                {stats?.totalShops || 0}
              </strong>
            </div>

            <div className="surface-card p-4">
              <span className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider block">
                Sản phẩm kiểm duyệt
              </span>
              <strong className="text-2xl font-bold text-[var(--info)] mt-1 block tabular-nums">
                {stats?.totalProducts || 0}
              </strong>
            </div>

            <div className="surface-card p-4 border-l-4 border-l-[var(--success-border)]">
              <span className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider block">
                Doanh thu hoàn thành (QD19)
              </span>
              <strong className="text-2xl font-bold text-[var(--success)] mt-1 block tabular-nums truncate">
                {moneyAdapter.formatVND(stats?.platformGMV || "0")}
              </strong>
            </div>
          </div>
        )}

        {/* Admin Navigation Tabs */}
        <nav aria-label="Bộ lọc quản trị sàn" className="overflow-x-auto pb-1 -mx-2 px-2">
          <div className="filter-tabs w-max min-w-full sm:w-auto">
            <button
              type="button"
              className={`filter-tab ${activeTab === "users" ? "filter-tab--active" : ""}`}
              onClick={() => setActiveTab("users")}
              aria-pressed={activeTab === "users"}
            >
              Người dùng ({users.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${activeTab === "shops" ? "filter-tab--active" : ""}`}
              onClick={() => setActiveTab("shops")}
              aria-pressed={activeTab === "shops"}
            >
              Gian hàng ({shops.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${activeTab === "products" ? "filter-tab--active" : ""}`}
              onClick={() => setActiveTab("products")}
              aria-pressed={activeTab === "products"}
            >
              Kiểm duyệt sản phẩm ({products.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${activeTab === "logs" ? "filter-tab--active" : ""}`}
              onClick={() => setActiveTab("logs")}
              aria-pressed={activeTab === "logs"}
            >
              Nhật ký kiểm duyệt ({logs.length})
            </button>
          </div>
        </nav>

        {/* Search Bar */}
        {activeTab !== "logs" && (
          <div className="max-w-md">
            <TextInput
              id="admin-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên, email..."
            />
          </div>
        )}

        {/* Content Area */}
        {loading ? (
          <div className="surface-card p-6 space-y-4" aria-busy="true">
            <Skeleton height={24} className="w-1/4" />
            <Skeleton height={60} />
            <Skeleton height={60} />
          </div>
        ) : error ? (
          <ErrorState title="Lỗi tải dữ liệu quản trị" description={error} onRetry={fetchData} />
        ) : (
          <>
            {/* TAB 1: USERS (A-705) */}
            {activeTab === "users" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Tài khoản / Họ tên</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4 text-center">Vai trò</th>
                        <th className="py-3 px-4 text-center">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác (A-705)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[var(--subtext)]">
                            Không tìm thấy tài khoản người dùng phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isLocked = u.status === "LOCKED";
                          const isAdmin = u.role === "ADMIN";

                          return (
                            <tr key={u.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                              <td className="py-3 px-4">
                                <strong className="font-semibold text-xs text-[var(--foreground)] block">
                                  {u.fullName}
                                </strong>
                                <span className="text-[11px] text-[var(--subtext)] font-mono">
                                  ID: {u.id}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-[var(--foreground)] font-mono">
                                {u.email}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    u.role === "ADMIN"
                                      ? "bg-[var(--primary-surface)] text-[var(--primary-active)]"
                                      : u.role === "SELLER"
                                      ? "bg-[var(--info-surface)] text-[var(--info)]"
                                      : "bg-[var(--card-muted)] text-[var(--subtext)]"
                                  }`}
                                >
                                  {u.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-block ${
                                    isLocked
                                      ? "bg-[var(--danger-surface)] text-[var(--danger)] border border-[var(--danger-border)]"
                                      : "bg-[var(--success-surface)] text-[var(--success)] border border-[var(--success-border)]"
                                  }`}
                                >
                                  {isLocked ? "Đã khóa" : "Hoạt động"}
                                </span>
                                {isLocked && u.lockReason && (
                                  <span className="text-[10px] text-[var(--danger)] block mt-0.5 max-w-xs truncate mx-auto" title={u.lockReason}>
                                    Lý do: {u.lockReason}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isAdmin ? (
                                  <span className="text-xs text-[var(--subtext)] italic">
                                    Không thể thao tác
                                  </span>
                                ) : isLocked ? (
                                  <Button
                                    variant="secondary"
                                    className="text-xs py-1 px-3"
                                    onClick={() => handleUnlockUser(u)}
                                  >
                                    Mở khóa
                                  </Button>
                                ) : (
                                  <Button
                                    variant="danger"
                                    className="text-xs py-1 px-3"
                                    onClick={() => {
                                      setLockingUser(u);
                                      setLockReason("");
                                      setLockError(null);
                                    }}
                                  >
                                    Khóa tài khoản
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: SHOPS */}
            {activeTab === "shops" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Tên Gian Hàng</th>
                        <th className="py-3 px-4">Chủ sở hữu</th>
                        <th className="py-3 px-4 text-center">Số sản phẩm</th>
                        <th className="py-3 px-4 text-center">Trạng thái</th>
                        <th className="py-3 px-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredShops.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[var(--subtext)]">
                            Không tìm thấy gian hàng phù hợp.
                          </td>
                        </tr>
                      ) : (
                        filteredShops.map((s) => {
                          const isLocked = s.status === "LOCKED";
                          return (
                            <tr key={s.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                              <td className="py-3 px-4">
                                <strong className="font-semibold text-xs text-[var(--foreground)] block">
                                  {s.name}
                                </strong>
                                <span className="text-[11px] text-[var(--subtext)] font-mono">
                                  ID: {s.id.slice(0, 8)}...
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-[var(--foreground)] font-mono">
                                {s.ownerEmail}
                              </td>
                              <td className="py-3 px-4 text-center font-bold text-xs tabular-nums">
                                {s.productCount}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-block ${
                                    isLocked
                                      ? "bg-[var(--danger-surface)] text-[var(--danger)] border border-[var(--danger-border)]"
                                      : "bg-[var(--success-surface)] text-[var(--success)] border border-[var(--success-border)]"
                                  }`}
                                >
                                  {isLocked ? "Đã khóa" : "Hoạt động"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isLocked ? (
                                  <Button
                                    variant="secondary"
                                    className="text-xs py-1 px-3"
                                    onClick={() => handleUnlockShop(s)}
                                  >
                                    Mở khóa shop
                                  </Button>
                                ) : (
                                  <Button
                                    variant="danger"
                                    className="text-xs py-1 px-3"
                                    onClick={() => {
                                      setLockingShop(s);
                                      setShopLockReason("");
                                      setShopLockError(null);
                                    }}
                                  >
                                    Khóa gian hàng
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: PRODUCTS MODERATION */}
            {activeTab === "products" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Tên Sản Phẩm</th>
                        <th className="py-3 px-4">Gian Hàng</th>
                        <th className="py-3 px-4 text-right">Giá Bán</th>
                        <th className="py-3 px-4 text-center">Báo Cáo</th>
                        <th className="py-3 px-4 text-center">Trạng Thái</th>
                        <th className="py-3 px-4 text-right">Kiểm Duyệt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-[var(--subtext)]">
                            Không tìm thấy sản phẩm cần kiểm duyệt.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => {
                          const isHidden = p.status === "HIDDEN";
                          return (
                            <tr key={p.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                              <td className="py-3 px-4">
                                <strong className="font-semibold text-xs text-[var(--foreground)] block">
                                  {p.name}
                                </strong>
                                <span className="text-[11px] text-[var(--subtext)] font-mono">
                                  ID: {p.id}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-xs text-[var(--subtext)]">
                                {p.shopName}
                              </td>
                              <td className="py-3 px-4 text-right font-bold text-xs tabular-nums text-[var(--foreground)]">
                                {moneyAdapter.formatVND(p.price)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    p.reports > 0
                                      ? "bg-[var(--danger-surface)] text-[var(--danger)]"
                                      : "bg-[var(--card-muted)] text-[var(--subtext)]"
                                  }`}
                                >
                                  {p.reports} vi phạm
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-block ${
                                    isHidden
                                      ? "bg-[var(--danger-surface)] text-[var(--danger)] border border-[var(--danger-border)]"
                                      : "bg-[var(--success-surface)] text-[var(--success)] border border-[var(--success-border)]"
                                  }`}
                                >
                                  {isHidden ? "Đã ẩn" : "Hiển thị"}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Button
                                  variant={isHidden ? "secondary" : "danger"}
                                  className="text-xs py-1 px-3"
                                  onClick={() => handleToggleProductStatus(p)}
                                >
                                  {isHidden ? "Khôi phục" : "Ẩn vi phạm"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: AUDIT LOGS */}
            {activeTab === "logs" && (
              <div className="surface-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">Thời gian</th>
                        <th className="py-3 px-4">Hành động</th>
                        <th className="py-3 px-4">Đối tượng</th>
                        <th className="py-3 px-4">Lý do ghi nhận</th>
                        <th className="py-3 px-4 text-right">Người thực hiện</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-[var(--subtext)]">
                            Chưa có bản ghi nhật ký kiểm duyệt nào.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                            <td className="py-3 px-4 text-xs text-[var(--subtext)] whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString("vi-VN")}
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--primary-surface)] text-[var(--primary-active)] uppercase tracking-wide">
                                {log.action}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-medium text-[var(--foreground)]">
                              {log.targetName || log.targetId}
                            </td>
                            <td className="py-3 px-4 text-xs text-[var(--foreground)] max-w-sm">
                              {log.reason}
                            </td>
                            <td className="py-3 px-4 text-right text-xs text-[var(--subtext)] font-mono">
                              {log.actor}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* DIALOG: Lock User (A-705) */}
        <Dialog
          open={Boolean(lockingUser)}
          onOpenChange={(open) => {
            if (!open && !isSubmittingLock) setLockingUser(null);
          }}
          title="Khóa tài khoản người dùng"
          description={`Tài khoản: ${lockingUser?.email} (${lockingUser?.fullName})`}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button
                variant="ghost"
                disabled={isSubmittingLock}
                onClick={() => setLockingUser(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                loading={isSubmittingLock}
                onClick={handleConfirmLockUser}
              >
                Xác nhận khóa tài khoản
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {lockError && (
              <div className="notice notice--warning" role="alert">
                <Icon name="warning" />
                <p className="text-xs">{lockError}</p>
              </div>
            )}
            <FormField
              id="lock-user-reason-input"
              label="Lý do khóa tài khoản (bắt buộc theo RB-LTT08)"
              required
              error={lockError && !lockReason.trim() ? "Vui lòng nhập lý do." : undefined}
            >
              <TextArea
                id="lock-user-reason-input"
                rows={3}
                placeholder="Nhập lý do cụ thể (vi phạm chính sách, spam, lừa đảo...)"
                value={lockReason}
                onChange={(e) => {
                  setLockReason(e.target.value);
                  setLockError(null);
                }}
              />
            </FormField>
            <p className="text-[11px] text-[var(--subtext)]">
              Lưu ý: Khóa tài khoản sẽ thu hồi quyền đăng nhập và ghi nhận tự động vào Nhật ký kiểm duyệt.
            </p>
          </div>
        </Dialog>

        {/* DIALOG: Lock Shop */}
        <Dialog
          open={Boolean(lockingShop)}
          onOpenChange={(open) => {
            if (!open && !isSubmittingShopLock) setLockingShop(null);
          }}
          title="Khóa gian hàng vi phạm"
          description={`Gian hàng: ${lockingShop?.name} (${lockingShop?.ownerEmail})`}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button
                variant="ghost"
                disabled={isSubmittingShopLock}
                onClick={() => setLockingShop(null)}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                loading={isSubmittingShopLock}
                onClick={handleConfirmLockShop}
              >
                Xác nhận khóa shop
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {shopLockError && (
              <div className="notice notice--warning" role="alert">
                <Icon name="warning" />
                <p className="text-xs">{shopLockError}</p>
              </div>
            )}
            <FormField
              id="lock-shop-reason-input"
              label="Lý do khóa gian hàng (bắt buộc)"
              required
              error={shopLockError && !shopLockReason.trim() ? "Vui lòng nhập lý do." : undefined}
            >
              <TextArea
                id="lock-shop-reason-input"
                rows={3}
                placeholder="Nhập lý do cụ thể (bán hàng giả, vi phạm sở hữu trí tuệ...)"
                value={shopLockReason}
                onChange={(e) => {
                  setShopLockReason(e.target.value);
                  setShopLockError(null);
                }}
              />
            </FormField>
          </div>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
