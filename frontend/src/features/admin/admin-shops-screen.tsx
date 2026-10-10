"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { repositories } from "../../lib/repositories/repository-factory";
import { type AdminShopItem, type ShopStatus } from "../../lib/repositories/types";
import { Button } from "../../components/ui/button";
import { TextInput, TextArea } from "../../components/ui/form-controls";
import { Dialog } from "../../components/ui/dialog";
import { Skeleton, ErrorState, EmptyState } from "../../components/ui/data-states";
import { useToast } from "../../components/ui/toast";
import { AdminHeaderNav } from "./admin-header-nav";
import { adminApi } from "../../lib/api/admin.api";
import { type ShopMallRequest } from "../../lib/api/seller-shop.api";

export function AdminShopsScreen() {
  const showToast = useToast();

  const [shops, setShops] = useState<AdminShopItem[]>([]);
  const [counts, setCounts] = useState<{ pending: number; active: number; locked: number; total: number }>({
    pending: 0,
    active: 0,
    locked: 0,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Tier update dialog
  const [tierTarget, setTierTarget] = useState<AdminShopItem | null>(null);
  const [newTier, setNewTier] = useState<"STANDARD" | "PREFERRED" | "MALL">("STANDARD");
  const [tierReason, setTierReason] = useState("");
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

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

  // Main Tab
  const [mainTab, setMainTab] = useState<"SHOPS" | "MALL_REQUESTS">("SHOPS");

  // Mall Requests State
  const [mallRequests, setMallRequests] = useState<ShopMallRequest[]>([]);
  const [mallStatusFilter, setMallStatusFilter] = useState<string>("ALL");
  const [isLoadingMall, setIsLoadingMall] = useState(false);
  const [pendingMallCount, setPendingMallCount] = useState(0);

  // Mall Approval / Rejection dialog state
  const [approveMallTarget, setApproveMallTarget] = useState<ShopMallRequest | null>(null);
  const [approveMallNote, setApproveMallNote] = useState("");
  const [isApprovingMall, setIsApprovingMall] = useState(false);

  const [rejectMallTarget, setRejectMallTarget] = useState<ShopMallRequest | null>(null);
  const [rejectMallReason, setRejectMallReason] = useState("");
  const [isRejectingMall, setIsRejectingMall] = useState(false);

  const fetchMallRequests = useCallback(async (status = mallStatusFilter) => {
    setIsLoadingMall(true);
    try {
      const data = await adminApi.getMallRequests({
        status: status !== "ALL" ? status : undefined,
      });
      setMallRequests(data);
      const pendingData = await adminApi.getMallRequests({ status: "PENDING" }).catch(() => []);
      setPendingMallCount(pendingData.length);
    } catch {
      // fallback
    } finally {
      setIsLoadingMall(false);
    }
  }, [mallStatusFilter]);

  const handleConfirmApproveMall = async () => {
    if (!approveMallTarget) return;
    if (!approveMallNote.trim()) {
      showToast("Vui lòng nhập ghi chú phê duyệt bắt buộc", "error");
      return;
    }
    setIsApprovingMall(true);
    try {
      await adminApi.approveMallRequest(approveMallTarget.request_id || approveMallTarget.id!, approveMallNote.trim());
      showToast("Đã phê duyệt yêu cầu nâng hạng Dino Mall thành công!", "success");
      setApproveMallTarget(null);
      setApproveMallNote("");
      await Promise.all([fetchMallRequests(), fetchShops(), fetchCounts()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Phê duyệt thất bại", "error");
    } finally {
      setIsApprovingMall(false);
    }
  };

  const handleConfirmRejectMall = async () => {
    if (!rejectMallTarget) return;
    if (!rejectMallReason.trim()) {
      showToast("Vui lòng nhập lý do từ chối bắt buộc", "error");
      return;
    }
    setIsRejectingMall(true);
    try {
      await adminApi.rejectMallRequest(rejectMallTarget.request_id || rejectMallTarget.id!, rejectMallReason.trim());
      showToast("Đã từ chối yêu cầu nâng hạng Dino Mall", "success");
      setRejectMallTarget(null);
      setRejectMallReason("");
      await fetchMallRequests();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Từ chối thất bại", "error");
    } finally {
      setIsRejectingMall(false);
    }
  };

  const fetchCounts = useCallback(async () => {
    try {
      const adminRepo = repositories.admin();
      const all = await adminRepo.getShops();
      setCounts({
        pending: all.filter((s) => s.status === "PENDING").length,
        active: all.filter((s) => s.status === "ACTIVE").length,
        locked: all.filter((s) => s.status === "LOCKED").length,
        total: all.length,
      });
    } catch {
      // fallback
    }
  }, []);

  const fetchShops = useCallback(async (currentStatus = statusFilter, currentSearch = searchQuery) => {
    setIsLoading(true);
    setError(null);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.getShopsPage) {
        const page = await adminRepo.getShopsPage({
          status: currentStatus !== "ALL" ? currentStatus : undefined,
          tier: tierFilter !== "ALL" ? tierFilter : undefined,
          search: currentSearch.trim() || undefined,
          limit: 20,
        });
        setShops(page.items);
        setNextCursor(page.next_cursor);
        setHasMore(page.has_more);
      } else {
        const data = await adminRepo.getShops({
          status: currentStatus !== "ALL" ? currentStatus : undefined,
          search: currentSearch.trim() || undefined,
        });
        setShops(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tải danh sách gian hàng thất bại");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, tierFilter, searchQuery]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchShops(statusFilter, searchQuery);
    });
  }, [statusFilter, searchQuery, fetchShops]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCounts();
    });
  }, [fetchCounts]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchMallRequests(mallStatusFilter);
    });
  }, [mallStatusFilter, fetchMallRequests]);

  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.getShopsPage) {
        const page = await adminRepo.getShopsPage({
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          tier: tierFilter !== "ALL" ? tierFilter : undefined,
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

  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    setIsApproving(true);
    try {
      await repositories.admin().approveShop(approveTarget.shop_id, "Shop verified and approved by admin");
      showToast(`Đã duyệt gian hàng ${approveTarget.shop_name} thành công!`, "success");
      setApproveTarget(null);
      await Promise.all([fetchShops(statusFilter, searchQuery), fetchCounts()]);
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
      await Promise.all([fetchShops(statusFilter, searchQuery), fetchCounts()]);
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
      await Promise.all([fetchShops(statusFilter, searchQuery), fetchCounts()]);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Mở khóa gian hàng thất bại", "error");
    }
  };

  const handleConfirmUpdateTier = async () => {
    if (!tierTarget) return;
    if (!tierReason.trim()) {
      showToast("Vui lòng nhập lý do thay đổi phân hạng", "error");
      return;
    }
    setIsUpdatingTier(true);
    try {
      const adminRepo = repositories.admin();
      if (adminRepo.updateShopTier) {
        await adminRepo.updateShopTier(tierTarget.shop_id, newTier, tierReason.trim());
      }
      showToast(`Đã cập nhật phân hạng ${tierTarget.shop_name} thành ${newTier}`, "success");
      setTierTarget(null);
      setTierReason("");
      await fetchShops();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Cập nhật phân hạng thất bại", "error");
    } finally {
      setIsUpdatingTier(false);
    }
  };

  // KPI counters (system-wide totals)
  const pendingCount = counts.pending;
  const activeCount = counts.active;
  const lockedCount = counts.locked;

  const filteredShops = shops.filter((s) =>
    (statusFilter === "ALL" || s.status === statusFilter) &&
    (tierFilter === "ALL" || (s.tier ?? "STANDARD") === tierFilter)
  );

  const renderTierBadge = (tier?: string) => {
    const t = tier ?? "STANDARD";
    if (t === "MALL") {
      return <span className="tier-badge tier-badge--mall">Mall</span>;
    }
    if (t === "PREFERRED") {
      return <span className="tier-badge tier-badge--preferred">Yêu thích</span>;
    }
    return <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--subtext)] bg-[var(--card-muted)]">Standard</span>;
  };

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
          <button
            type="button"
            onClick={() => setMainTab("SHOPS")}
            className={`pb-3 border-b-2 transition-colors ${
              mainTab === "SHOPS"
                ? "border-[var(--primary-active)] text-[var(--primary-active)]"
                : "border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
            }`}
          >
            Duyệt gian hàng (Shop)
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMainTab("MALL_REQUESTS");
              void fetchMallRequests();
            }}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              mainTab === "MALL_REQUESTS"
                ? "border-rose-600 text-rose-600 dark:text-rose-400"
                : "border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
            }`}
          >
            <span>🏆 Yêu cầu lên Dino Mall</span>
            {pendingMallCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                {pendingMallCount}
              </span>
            )}
          </button>
          <Link
            href="/admin/categories"
            className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Quản lý danh mục
          </Link>
        </div>
      </nav>

      {mainTab === "SHOPS" ? (
        <>
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
              <option value="ALL">Tất cả trạng thái ({counts.total})</option>
              <option value="PENDING">Chờ duyệt (PENDING - {pendingCount})</option>
              <option value="ACTIVE">Hoạt động (ACTIVE - {activeCount})</option>
              <option value="LOCKED">Bị khóa (LOCKED - {lockedCount})</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="shop-tier-filter" className="font-semibold text-[var(--subtext)]">
              Phân hạng:
            </label>
            <select
              id="shop-tier-filter"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
            >
              <option value="ALL">Tất cả phân hạng</option>
              <option value="STANDARD">STANDARD (Tiêu chuẩn)</option>
              <option value="PREFERRED">PREFERRED (Yêu thích)</option>
              <option value="MALL">MALL (Shopee Mall)</option>
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
                  <th className="py-3.5 px-4 text-center">Phân hạng</th>
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
                        {renderTierBadge(shop.tier)}
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
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setTierTarget(shop);
                              setNewTier(shop.tier ?? "STANDARD");
                              setTierReason("");
                            }}
                            className="h-8 px-2.5 text-xs"
                          >
                            Đổi hạng
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
        </>
      ) : (
        /* Giao diện Xét duyệt Yêu cầu Dino Mall */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="mall-status-filter" className="font-semibold text-[var(--subtext)]">
                Trạng thái duyệt:
              </label>
              <select
                id="mall-status-filter"
                value={mallStatusFilter}
                onChange={(e) => setMallStatusFilter(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
              >
                <option value="ALL">Tất cả yêu cầu</option>
                <option value="PENDING">Chờ duyệt (PENDING - {pendingMallCount})</option>
                <option value="APPROVED">Đã phê duyệt (APPROVED)</option>
                <option value="REJECTED">Đã từ chối (REJECTED)</option>
                <option value="CANCELLED">Đã hủy (CANCELLED)</option>
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void fetchMallRequests()}
              disabled={isLoadingMall}
              className="text-xs"
            >
              ↻ Làm mới danh sách
            </Button>
          </div>

          {isLoadingMall ? (
            <div className="space-y-2">
              <Skeleton height={50} />
              <Skeleton height={200} />
            </div>
          ) : mallRequests.length === 0 ? (
            <EmptyState
              title="Không có yêu cầu nâng hạng nào"
              description="Hiện tại chưa có gian hàng nào nộp yêu cầu nâng hạng lên Dino Mall phù hợp với bộ lọc."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--card-muted)] text-xs text-[var(--subtext)] uppercase border-b border-[var(--border)]">
                  <tr>
                    <th className="px-4 py-3">Mã Shop / Seller</th>
                    <th className="px-4 py-3">Hồ sơ xác thực</th>
                    <th className="px-4 py-3">Liên hệ & Ghi chú</th>
                    <th className="px-4 py-3">Ngày gửi</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {mallRequests.map((req, index) => (
                    <tr key={req.request_id || req.id || String(index)} className="hover:bg-[var(--card-hover)]">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-[var(--foreground)]">
                          {(req as { shop_name?: string }).shop_name
                            ? `${(req as { shop_name?: string }).shop_name} (${req.shop_id})`
                            : `Shop: ${req.shop_id}`}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--subtext)]">Seller: {req.seller_id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={req.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--primary)] underline hover:opacity-80 max-w-[200px] truncate block"
                          title={req.document_url}
                        >
                          📄 Xem tài liệu
                        </a>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-[var(--subtext)] italic truncate max-w-[200px]" title={req.reason}>{req.reason}</div>
                        {req.admin_note && <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">Ghi chú duyệt: {req.admin_note}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--subtext)] font-mono">
                        {new Date(req.created_at).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3">
                        {req.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            ⏳ Chờ duyệt
                          </span>
                        ) : req.status === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                            ✓ Đã duyệt
                          </span>
                        ) : req.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            ✕ Từ chối
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--muted)] text-[var(--subtext)]">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {req.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                setApproveMallTarget(req);
                                setApproveMallNote("Hồ sơ thương hiệu hợp lệ, đủ điều kiện Dino Mall.");
                              }}
                              className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              Duyệt Mall
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                setRejectMallTarget(req);
                                setRejectMallReason("");
                              }}
                              className="text-xs px-2.5 py-1 text-rose-600 hover:text-rose-700 border-rose-200"
                            >
                              Từ chối
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      {/* Modal: Đổi hạng gian hàng */}
      <Dialog
        open={Boolean(tierTarget)}
        onOpenChange={(isOpen) => !isUpdatingTier && !isOpen && setTierTarget(null)}
        title={`Đổi phân hạng gian hàng: ${tierTarget?.shop_name || ""}`}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[var(--subtext)]">
            Phân hạng gian hàng ảnh hưởng đến huy hiệu hiển thị trên sản phẩm (Mall, Shop Yêu thích).
          </p>
          <div>
            <label htmlFor="admin-change-tier-select" className="block text-xs font-semibold text-[var(--subtext)] mb-1">
              Phân hạng mới <span className="text-red-500">*</span>
            </label>
            <select
              id="admin-change-tier-select"
              value={newTier}
              onChange={(e) => setNewTier(e.target.value as "STANDARD" | "PREFERRED" | "MALL")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)]"
            >
              <option value="STANDARD">STANDARD - Tiêu chuẩn (Không huy hiệu)</option>
              <option value="PREFERRED">PREFERRED - Shop Yêu thích</option>
              <option value="MALL">MALL - Shopee / Dino Mall chính hãng</option>
            </select>
          </div>
          <div>
            <label htmlFor="admin-change-tier-reason" className="block text-xs font-semibold text-[var(--subtext)] mb-1">
              Lý do thay đổi hạng <span className="text-red-500">*</span>
            </label>
            <TextArea
              id="admin-change-tier-reason"
              placeholder="Nhập lý do cụ thể (Bắt buộc theo quy định kiểm toán)"
              value={tierReason}
              onChange={(e) => setTierReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button
              variant="secondary"
              onClick={() => setTierTarget(null)}
              disabled={isUpdatingTier}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmUpdateTier}
              disabled={isUpdatingTier || !tierReason.trim()}
            >
              {isUpdatingTier ? "Đang lưu..." : "Lưu thay đổi"}
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

      {/* Modal: Duyệt yêu cầu Dino Mall */}
      {approveMallTarget && (
        <Dialog
          open
          onOpenChange={(isOpen) => !isApprovingMall && !isOpen && setApproveMallTarget(null)}
          title="Phê duyệt nâng hạng Dino Mall"
        >
          <div className="space-y-4 text-sm">
            <p className="text-[var(--subtext)]">
              Khi phê duyệt, gian hàng sẽ được nâng lên hạng <strong>DINO MALL</strong> ngay lập tức. Hành động này ghi nhận nhật ký kiểm duyệt hệ thống.
            </p>
            <div className="p-3 rounded-lg bg-[var(--card-muted)] text-xs space-y-1">
              <div>Mã shop: <strong className="font-mono">{approveMallTarget.shop_id}</strong></div>
              <div>Tài liệu: <a href={approveMallTarget.document_url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline">{approveMallTarget.document_url}</a></div>
            </div>
            <div>
              <label htmlFor="approve-mall-note" className="block text-xs font-semibold mb-1">
                Ghi chú phê duyệt (Bắt buộc):
              </label>
              <TextArea
                id="approve-mall-note"
                rows={3}
                required
                placeholder="Nhập ghi chú hoặc căn cứ phê duyệt..."
                value={approveMallNote}
                onChange={(e) => setApproveMallNote(e.target.value)}
                disabled={isApprovingMall}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setApproveMallTarget(null)} disabled={isApprovingMall}>
                Hủy
              </Button>
              <Button onClick={() => void handleConfirmApproveMall()} disabled={isApprovingMall || !approveMallNote.trim()}>
                {isApprovingMall ? "Đang xử lý..." : "Xác nhận duyệt Mall"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal: Từ chối yêu cầu Dino Mall */}
      {rejectMallTarget && (
        <Dialog
          open
          onOpenChange={(isOpen) => !isRejectingMall && !isOpen && setRejectMallTarget(null)}
          title="Từ chối yêu cầu nâng hạng Dino Mall"
        >
          <div className="space-y-4 text-sm">
            <p className="text-[var(--subtext)]">
              Vui lòng nêu rõ lý do từ chối để Người bán nắm rõ thông tin và bổ sung tài liệu hợp lệ.
            </p>
            <div>
              <label htmlFor="reject-mall-reason" className="block text-xs font-semibold mb-1">
                Lý do từ chối (Bắt buộc):
              </label>
              <TextArea
                id="reject-mall-reason"
                rows={3}
                required
                placeholder="Ví dụ: Giấy ủy quyền đã hết hạn, vui lòng nộp bản công chứng mới nhất..."
                value={rejectMallReason}
                onChange={(e) => setRejectMallReason(e.target.value)}
                disabled={isRejectingMall}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRejectMallTarget(null)} disabled={isRejectingMall}>
                Hủy
              </Button>
              <Button
                variant="secondary"
                onClick={() => void handleConfirmRejectMall()}
                disabled={isRejectingMall || !rejectMallReason.trim()}
                className="text-rose-600 hover:text-rose-700 border-rose-300"
              >
                {isRejectingMall ? "Đang xử lý..." : "Xác nhận từ chối"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  );
}
