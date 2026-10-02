"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { repositories } from "../../lib/repositories/repository-factory";
import { type AdminShopItem, type ShopStatus } from "../../lib/repositories/types";
import { Button } from "../../components/ui/button";
import { TextInput, TextArea } from "../../components/ui/form-controls";
import { Dialog } from "../../components/ui/dialog";
import { Skeleton, ErrorState, EmptyState } from "../../components/ui/data-states";
import { useToast } from "../../components/ui/toast";
import { AdminHeaderNav } from "./admin-header-nav";

export function AdminShopsScreen() {
  const showToast = useToast();

  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Approve dialog
  const [approveTarget, setApproveTarget] = useState<AdminShopItem | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Lock shop dialog
  const [lockTarget, setLockTarget] = useState<AdminShopItem | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [isLocking, setIsLocking] = useState(false);

  // Detail dialog
  const [detailShop, setDetailShop] = useState<AdminShopItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const fetchShops = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.getShopsPage) {
        const page = await adminRepo.getShopsPage({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          limit: 20,
        });
        setShops(page.items);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
      } else {
        const data = await adminRepo.getShops();
        setShops(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tải danh sách gian hàng thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.getShopsPage) {
        const page = await adminRepo.getShopsPage({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
          cursor: nextCursor,
          limit: 20,
        });
        setShops((prev) => [...prev, ...page.items]);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Không thể tải thêm gian hàng", "error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleViewDetail = async (shop: AdminShopItem) => {
    setIsLoadingDetail(true);
    setDetailShop(shop);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.getShopDetail) {
        const fullDetail = await adminRepo.getShopDetail(shop.shop_id);
        setDetailShop(fullDetail);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Không thể tải chi tiết gian hàng", "error");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadInitial = async () => {
      try {
        const adminRepo = repositories.admin();
        if (adminRepo.getShopsPage) {
          const page = await adminRepo.getShopsPage({ limit: 20 });
          if (!ignore) {
            setShops(page.items);
            setNextCursor(page.next_cursor);
            setHasMore(page.has_more);
            setIsLoading(false);
          }
        } else {
          const data = await adminRepo.getShops();
          if (!ignore) {
            setShops(data);
            setIsLoading(false);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Tải danh sách gian hàng thất bại");
          setIsLoading(false);
        }
      }
    };
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    setIsApproving(true);
    try {
      await repositories.admin().approveShop(approveTarget.shop_id, "Shop verified and approved by admin");
      showToast(`Đã duyệt gian hàng ${approveTarget.shop_name} thành công!`, "success");
      setApproveTarget(null);
      await fetchShops();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Duyệt gian hàng thất bại", "error");
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmLock = async () => {
    if (!lockTarget) return;
    if (!lockReason.trim()) {
      showToast("Vui lòng nhập lý do khóa gian hàng", "error");
      return;
    }

    setIsLocking(true);
    try {
      await repositories.admin().lockShop({
        shop_id: lockTarget.shop_id,
        reason: lockReason.trim(),
      });
      showToast(`Đã khóa gian hàng ${lockTarget.shop_name}`, "success");
      setLockTarget(null);
      setLockReason("");
      await fetchShops();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Khóa gian hàng thất bại", "error");
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockShop = async (shop: AdminShopItem) => {
    try {
      await repositories.admin().unlockShop(shop.shop_id, "Shop unlocked after compliance review");
      showToast(`Đã mở khóa gian hàng ${shop.shop_name}`, "success");
      await fetchShops();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Mở khóa gian hàng thất bại", "error");
    }
  };

  // KPI counters
  const pendingCount = shops.filter((s) => s.status === "PENDING").length;
  const activeCount = shops.filter((s) => s.status === "ACTIVE").length;
  const lockedCount = shops.filter((s) => s.status === "LOCKED").length;

  const filteredShops = shops.filter((s) => {
    if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.shop_name.toLowerCase().includes(q) ||
        (s.owner_email && s.owner_email.toLowerCase().includes(q)) ||
        (s.owner_name && s.owner_name.toLowerCase().includes(q)) ||
        s.shop_id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderStatusBadge = (status: ShopStatus) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            Chờ duyệt
          </span>
        );
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Đang hoạt động
          </span>
        );
      case "LOCKED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Đang bị khóa
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
            Tạm ngưng
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--card)] text-[var(--subtext)]">
            {status}
          </span>
        );
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <AdminHeaderNav currentModule="Quản lý gian hàng (A-708)" />
          <h1 className="page-title">Quản Lý & Duyệt Gian Hàng</h1>
          <p className="page-description">
            Kiểm duyệt hồ sơ đăng ký kinh doanh, duyệt gian hàng PENDING và giám sát tuân thủ của người bán.
          </p>
        </div>
      </header>

      {/* Tabs */}
      <nav aria-label="Điều hướng quản trị" className="border-b border-[var(--border)]">
        <div className="flex gap-6 text-sm font-semibold">
          <Link
            href="/admin/shops"
            className="pb-3 border-b-2 border-[var(--primary-active)] text-[var(--primary-active)]"
            aria-current="page"
          >
            Duyệt gian hàng (Shop)
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/categories"
            className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Quản lý danh mục
          </Link>
        </div>
      </nav>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter("PENDING")}
          className={`surface-card p-4 text-left transition-all rounded-xl border ${
            statusFilter === "PENDING"
              ? "border-amber-500 bg-amber-500/5 shadow-sm"
              : "border-[var(--border)] hover:border-amber-500/50"
          }`}
        >
          <div className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
            Gian hàng chờ duyệt
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pendingCount}
            </span>
            <span className="text-xs text-[var(--subtext)]">shop cần duyệt</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("ACTIVE")}
          className={`surface-card p-4 text-left transition-all rounded-xl border ${
            statusFilter === "ACTIVE"
              ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
              : "border-[var(--border)] hover:border-emerald-500/50"
          }`}
        >
          <div className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
            Đang hoạt động
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </span>
            <span className="text-xs text-[var(--subtext)]">shop đang mở</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("LOCKED")}
          className={`surface-card p-4 text-left transition-all rounded-xl border ${
            statusFilter === "LOCKED"
              ? "border-rose-500 bg-rose-500/5 shadow-sm"
              : "border-[var(--border)] hover:border-rose-500/50"
          }`}
        >
          <div className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
            Đang bị khóa
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {lockedCount}
            </span>
            <span className="text-xs text-[var(--subtext)]">shop vi phạm</span>
          </div>
        </button>
      </div>

      {/* Controls: Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full sm:w-80">
            <TextInput
              id="admin-search-shops"
              placeholder="Tìm theo tên shop, email chủ shop, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="shop-status-filter" className="font-semibold text-[var(--subtext)]">
              Trạng thái:
            </label>
            <select
              id="shop-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
            >
              <option value="ALL">Tất cả trạng thái ({shops.length})</option>
              <option value="PENDING">Chờ duyệt (PENDING - {pendingCount})</option>
              <option value="ACTIVE">Hoạt động (ACTIVE - {activeCount})</option>
              <option value="LOCKED">Bị khóa (LOCKED - {lockedCount})</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-[var(--subtext)]">
          Hiển thị: <strong className="text-[var(--foreground)]">{filteredShops.length}</strong> gian hàng
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="space-y-3 surface-card p-6">
          <Skeleton height={32} className="w-1/4" />
          <Skeleton height={48} className="w-full" />
          <Skeleton height={48} className="w-full" />
          <Skeleton height={48} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải danh sách gian hàng"
          description={error}
          onRetry={fetchShops}
        />
      ) : filteredShops.length === 0 ? (
        <EmptyState
          icon="bag"
          title="Không tìm thấy gian hàng phù hợp"
          description="Hãy thử thay đổi điều kiện tìm kiếm hoặc chọn bộ lọc trạng thái khác."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs font-bold text-[var(--subtext)]">
                  <th className="py-3.5 px-4">Gian hàng</th>
                  <th className="py-3.5 px-4">Chủ sở hữu</th>
                  <th className="py-3.5 px-4">Liên hệ & Địa chỉ</th>
                  <th className="py-3.5 px-4 text-center">Sản phẩm</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredShops.map((shop) => {
                  const isPending = shop.status === "PENDING";
                  const isActive = shop.status === "ACTIVE";
                  const isLocked = shop.status === "LOCKED";

                  return (
                    <tr key={shop.shop_id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--foreground)]">{shop.shop_name}</div>
                        {shop.description && (
                          <div className="text-xs text-[var(--subtext)] line-clamp-1">{shop.description}</div>
                        )}
                        <div className="text-xs text-[var(--subtext)] font-mono mt-0.5">ID: {shop.shop_id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-[var(--foreground)]">
                          {shop.owner_name || "Chưa cập nhật tên"}
                        </div>
                        <div className="text-xs text-[var(--subtext)] font-mono">
                          {shop.owner_email || shop.owner_id}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[var(--subtext)]">
                        <div>ĐT: <span className="font-mono text-[var(--foreground)]">{shop.contact_phone || "Chưa có"}</span></div>
                        <div className="line-clamp-1 max-w-xs">{shop.pickup_address || "Chưa cập nhật địa chỉ"}</div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--card-muted)] text-[var(--foreground)]">
                          {shop.product_count} SP
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {renderStatusBadge(shop.status)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            onClick={() => handleViewDetail(shop)}
                            className="h-8 px-2.5 text-xs"
                          >
                            Chi tiết
                          </Button>
                          {isPending && (
                            <Button
                              variant="primary"
                              onClick={() => setApproveTarget(shop)}
                              disabled={!shop.pickup_address?.trim() || !shop.contact_phone?.trim()}
                              title={!shop.pickup_address?.trim() || !shop.contact_phone?.trim() ? "Shop cần có địa chỉ nhận hàng và số điện thoại liên hệ trước khi duyệt" : undefined}
                              className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                            >
                              {!shop.pickup_address?.trim() || !shop.contact_phone?.trim() ? "Thiếu hồ sơ" : "Duyệt ngay"}
                            </Button>
                          )}
                          {isActive && (
                            <Button
                              variant="danger"
                              onClick={() => {
                                setLockTarget(shop);
                                setLockReason("");
                              }}
                              className="h-8 px-3 text-xs"
                            >
                              Khóa shop
                            </Button>
                          )}
                          {isLocked && (
                            <Button
                              variant="secondary"
                              onClick={() => handleUnlockShop(shop)}
                              className="h-8 px-3 text-xs border-emerald-600/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            >
                              Mở khóa
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-4 border-t border-[var(--border)] flex justify-center bg-[var(--card)]">
              <Button
                variant="secondary"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="text-xs px-6 py-2"
              >
                {isLoadingMore ? "Đang tải thêm..." : "Tải thêm gian hàng"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Xác nhận duyệt shop */}
      <Dialog
        open={Boolean(approveTarget)}
        onOpenChange={(isOpen) => !isApproving && !isOpen && setApproveTarget(null)}
        title="Xác nhận duyệt gian hàng"
      >
        <div className="space-y-4 text-sm">
          <p className="text-[var(--subtext)]">
            Bạn có chắc chắn muốn duyệt và kích hoạt gian hàng{" "}
            <strong className="text-[var(--foreground)] font-semibold">{approveTarget?.shop_name}</strong>?
          </p>
          <div className="surface-card p-3 rounded-lg text-xs space-y-1 bg-[var(--card-muted)]">
            <div>Chủ shop: <strong>{approveTarget?.owner_name || approveTarget?.owner_email}</strong></div>
            <div>Email: <strong className="font-mono">{approveTarget?.owner_email}</strong></div>
            <div>Mã gian hàng: <strong className="font-mono">{approveTarget?.shop_id}</strong></div>
          </div>
          <p className="text-xs text-[var(--subtext)]">
            Sau khi duyệt, chủ shop sẽ được phép đăng tải sản phẩm và nhận đơn đặt hàng từ người mua.
          </p>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setApproveTarget(null)}
              disabled={isApproving}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmApprove}
              disabled={isApproving}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {isApproving ? "Đang xử lý..." : "Xác nhận duyệt"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Khóa shop */}
      <Dialog
        open={Boolean(lockTarget)}
        onOpenChange={(isOpen) => !isLocking && !isOpen && setLockTarget(null)}
        title={`Khóa gian hàng: ${lockTarget?.shop_name || ""}`}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[var(--subtext)]">
            Khóa gian hàng sẽ tạm ngưng hiển thị toàn bộ sản phẩm của shop trên sàn và chặn người mua đặt hàng.
          </p>
          <div>
            <label htmlFor="admin-lock-shop-reason" className="block text-xs font-semibold text-[var(--subtext)] mb-1">
              Lý do khóa gian hàng <span className="text-red-500">*</span>
            </label>
            <TextArea
              id="admin-lock-shop-reason"
              placeholder="Nhập lý do cụ thể (VD: Bán hàng giả, gian lận thanh toán, vi phạm quy định sàn...)"
              value={lockReason}
              onChange={(e) => setLockReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setLockTarget(null)}
              disabled={isLocking}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmLock}
              disabled={isLocking || !lockReason.trim()}
            >
              {isLocking ? "Đang khóa..." : "Khóa gian hàng"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Modal: Xem chi tiết shop */}
      {detailShop && (
        <Dialog
          open
          onOpenChange={(isOpen) => !isOpen && setDetailShop(null)}
          title={`Chi tiết gian hàng: ${detailShop.shop_name}`}
        >
          <div className="space-y-3 text-sm">
            {isLoadingDetail && (
              <p className="text-xs text-[var(--subtext)] italic">Đang tải dữ liệu chi tiết mới nhất...</p>
            )}
            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--card-muted)] rounded-lg text-xs">
              <div>
                <span className="text-[var(--subtext)] block">Tên gian hàng:</span>
                <strong className="text-[var(--foreground)]">{detailShop.shop_name}</strong>
              </div>
              <div>
                <span className="text-[var(--subtext)] block">Mã shop:</span>
                <strong className="font-mono text-[var(--foreground)]">{detailShop.shop_id}</strong>
              </div>
              <div>
                <span className="text-[var(--subtext)] block">Chủ sở hữu:</span>
                <strong className="text-[var(--foreground)]">{detailShop.owner_name || detailShop.owner_email || "N/A"}</strong>
              </div>
              <div>
                <span className="text-[var(--subtext)] block">Email:</span>
                <strong className="font-mono text-[var(--foreground)]">{detailShop.owner_email || "N/A"}</strong>
              </div>
              <div>
                <span className="text-[var(--subtext)] block">Điện thoại liên hệ:</span>
                <strong className="font-mono text-[var(--foreground)]">{detailShop.contact_phone || "Chưa thiết lập"}</strong>
              </div>
              <div>
                <span className="text-[var(--subtext)] block">Số sản phẩm:</span>
                <strong className="text-[var(--foreground)]">{detailShop.product_count} sản phẩm</strong>
              </div>
              <div className="col-span-2">
                <span className="text-[var(--subtext)] block">Địa chỉ lấy hàng / kho:</span>
                <span className="text-[var(--foreground)] font-semibold">{detailShop.pickup_address || "Chưa thiết lập"}</span>
              </div>
              {detailShop.description && (
                <div className="col-span-2">
                  <span className="text-[var(--subtext)] block">Mô tả gian hàng:</span>
                  <span className="text-[var(--foreground)]">{detailShop.description}</span>
                </div>
              )}
              <div className="col-span-2 flex items-center justify-between pt-1 border-t border-[var(--border)]">
                <div>
                  <span className="text-[var(--subtext)] block">Trạng thái:</span>
                  {renderStatusBadge(detailShop.status)}
                </div>
                {detailShop.created_at && (
                  <div className="text-right">
                    <span className="text-[var(--subtext)] block">Ngày tham gia:</span>
                    <span className="font-mono text-[var(--foreground)]">{new Date(detailShop.created_at).toLocaleDateString("vi-VN")}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setDetailShop(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  );
}
