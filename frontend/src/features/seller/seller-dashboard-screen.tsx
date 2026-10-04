"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/data-states";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { useAuth } from "@/lib/auth/auth-context";
import { repositories } from "@/lib/repositories/repository-factory";
import type { SellerKPIStats } from "@/features/admin/admin.types";
import type { WireOrder } from "@/lib/api/order.api";
import type { WireCatalogProductItem } from "@/lib/api/catalog.api";
import { SellerHeaderNav } from "./seller-header-nav";

export function SellerDashboardScreen() {
  const { user } = useAuth();
  const isShopPending = user?.role === "SELLER" && user?.shopStatus === "PENDING";
  const [kpi, setKpi] = useState<SellerKPIStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<WireOrder[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<WireCatalogProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [kpiData, ordersData, catalogData] = await Promise.all([
        repositories.seller().getKpi(),
        repositories.order().getOrders(),
        repositories.catalog().getSellerProducts({ limit: 50 }),
      ]);

      setKpi(kpiData);
      setRecentOrders(ordersData);

      // Low stock criteria: total_stock <= 20
      const lowStock = catalogData
        .filter((p) => (p.total_stock ?? 0) <= 20)
        .slice(0, 6);
      setLowStockProducts(lowStock);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Không thể tải dữ liệu bảng điều khiển người bán."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchDashboardData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDashboardData]);

  const pendingOrders = recentOrders.filter(
    (o) => o.status === "PENDING_CONFIRMATION" || o.status === "CONFIRMED" || o.status === "PREPARING"
  );

  return (
    <ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>
      <div className="seller-dashboard min-h-screen py-8 px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[var(--border)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--subtext)] mb-1">
              <span>Kênh người bán</span>
              <Icon name="chevron-right" className="w-3.5 h-3.5" />
              <span className="text-[var(--foreground)]">Bảng điều khiển</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
              {kpi?.shopName || "Gian hàng của tôi"}
            </h1>
            <p className="text-sm text-[var(--subtext)] mt-1">
              Theo dõi hiệu quả kinh doanh, xử lý đơn hàng và giám sát tồn kho thực tế.
            </p>
          </div>

          {/* Quick Hub Navigation Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <Link
              href="/seller"
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--primary)] text-white shadow-sm flex items-center gap-2 whitespace-nowrap"
            >
              <Icon name="grid" className="w-4 h-4" />
              <span>Tổng quan KPI</span>
            </Link>
            <Link
              href="/seller/orders"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--card)] hover:bg-[var(--card-muted)] text-[var(--foreground)] border border-[var(--border)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Icon name="bag" className="w-4 h-4 text-[var(--subtext)]" />
              <span>Xử lý đơn hàng</span>
              {kpi && kpi.pendingOrdersCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs font-bold rounded-full bg-[var(--danger)] text-white">
                  {kpi.pendingOrdersCount}
                </span>
              )}
            </Link>
            <Link
              href="/seller/products"
              className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--card)] hover:bg-[var(--card-muted)] text-[var(--foreground)] border border-[var(--border)] transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Icon name="grid" className="w-4 h-4 text-[var(--subtext)]" />
              <span>Sản phẩm & Tồn kho</span>
            </Link>
          </div>
        </div>

        {/* Sub-navigation tabs across all seller features */}
        <div className="pt-4">
          <SellerHeaderNav />
        </div>

        {/* Shop Pending Warning Banner (A-103) */}
        {isShopPending && (
          <div className="mt-6 notice notice--warning" role="alert" data-testid="shop-pending-banner">
            <Icon name="info" />
            <div>
              <strong>Gian hàng đang chờ duyệt:</strong> Gian hàng của bạn đang ở trạng thái chờ Admin duyệt. Bạn chưa thể tạo sản phẩm hoặc thay đổi tồn kho cho đến khi được kích hoạt.
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-6 mt-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton height={128} className="rounded-xl" />
              <Skeleton height={128} className="rounded-xl" />
              <Skeleton height={128} className="rounded-xl" />
              <Skeleton height={128} className="rounded-xl" />
            </div>
            <Skeleton height={256} className="rounded-xl" />
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="mt-8">
            <ErrorState
              title="Lỗi tải dữ liệu người bán"
              description={error}
              onRetry={() => {
                void fetchDashboardData();
              }}
            />
          </div>
        )}

        {/* Main Content */}
        {!isLoading && !error && kpi && (
          <div className="space-y-8 mt-8">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1: Revenue (QD19) */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                      Doanh thu thực tế
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[var(--success-surface)] text-[var(--success)] border border-[var(--success-border)]">
                      QD19
                    </span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] mt-2">
                    {moneyAdapter.formatVND(kpi.totalRevenue)}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-1.5 text-xs text-[var(--subtext)]">
                  <Icon name="check" className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
                  <span>Chỉ ghi nhận từ các đơn <strong>COMPLETED</strong></span>
                </div>
              </div>

              {/* Card 2: Completed Orders */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                      Đơn hoàn tất
                    </span>
                    <div className="p-2 rounded-lg bg-[var(--primary-surface)] text-[var(--primary)]">
                      <Icon name="check" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] mt-2">
                    {kpi.completedOrdersCount} <span className="text-base font-normal text-[var(--subtext)]">đơn</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] text-xs text-[var(--subtext)]">
                  Giao hàng thành công & đã quyết toán
                </div>
              </div>

              {/* Card 3: Pending Orders */}
              <div
                className={`bg-[var(--card)] border rounded-2xl p-5 shadow-sm flex flex-col justify-between ${
                  kpi.pendingOrdersCount > 0
                    ? "border-[var(--warning-border)] bg-[var(--warning-surface)]/20"
                    : "border-[var(--border)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                      Chờ xác nhận
                    </span>
                    <div
                      className={`p-2 rounded-lg ${
                        kpi.pendingOrdersCount > 0
                          ? "bg-[var(--warning-surface)] text-[var(--warning)]"
                          : "bg-[var(--card-muted)] text-[var(--subtext)]"
                      }`}
                    >
                      <Icon name="warning" className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] mt-2">
                    {kpi.pendingOrdersCount} <span className="text-base font-normal text-[var(--subtext)]">đơn</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between">
                  <span className="text-xs text-[var(--subtext)]">
                    {kpi.pendingOrdersCount > 0 ? "Cần đóng gói & xác nhận" : "Hàng đợi sạch sẽ"}
                  </span>
                  {kpi.pendingOrdersCount > 0 && (
                    <Link
                      href="/seller/orders"
                      className="text-xs font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-1"
                    >
                      Xử lý ngay &rarr;
                    </Link>
                  )}
                </div>
              </div>

              {/* Card 4: Store Quality & Active Products */}
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                      Đánh giá & Sản phẩm
                    </span>
                    <div className="p-2 rounded-lg bg-[var(--info-surface)] text-[var(--info)]">
                      <Icon name="star" className="w-4 h-4 text-amber-500 fill-amber-500" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] mt-2 flex items-baseline gap-2">
                    <span>{kpi.averageRating}</span>
                    <span className="text-xs font-medium text-[var(--subtext)]">/ 5.0 sao</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--subtext)]">
                  <span>{kpi.activeProductsCount} sản phẩm đang mở bán</span>
                  <Link href="/seller/products" className="text-[var(--primary)] hover:underline">
                    Kho hàng
                  </Link>
                </div>
              </div>
            </div>

            {/* Rule QD19 Transparency Banner */}
            <div className="bg-[var(--card)] border border-[var(--info-border)] rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 bg-gradient-to-r from-[var(--info-surface)]/40 to-transparent">
              <div className="p-2 rounded-xl bg-[var(--info-surface)] text-[var(--info)] shrink-0">
                <Icon name="info" className="w-5 h-5" />
              </div>
              <div className="text-sm">
                <h4 className="font-semibold text-[var(--foreground)]">
                  Chính sách quy chuẩn doanh thu sàn (Quy tắc QD19)
                </h4>
                <p className="text-[var(--subtext)] text-xs sm:text-sm mt-0.5 leading-relaxed">
                  Để đảm bảo tính toàn vẹn và chống thất thoát tài chính, số liệu <strong>Doanh thu thực tế</strong> của gian hàng chỉ được tổng hợp từ các đơn hàng có trạng thái <strong>COMPLETED (Đã hoàn thành)</strong>. Các đơn hàng đang giao, chờ xác nhận hoặc đã hủy sẽ không được tạm tính vào doanh thu.
                </p>
              </div>
            </div>

            {/* Split Grid: Action Queue (Orders) & Low Stock Alert */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Recent Orders Needing Attention (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                      Hàng đợi đơn hàng cần xử lý
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--card-muted)] text-[var(--subtext)]">
                      {pendingOrders.length}
                    </span>
                  </div>
                  <Link
                    href="/seller/orders"
                    className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    Xem tất cả đơn hàng &rarr;
                  </Link>
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                  {pendingOrders.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon="info"
                        title="Không có đơn hàng chờ xử lý"
                        description="Tất cả các đơn hàng mới đã được xác nhận và bàn giao vận chuyển."
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {pendingOrders.slice(0, 5).map((order) => {
                        const itemsCount = order.items?.reduce((sum, it) => sum + it.quantity, 0) || 0;
                        const displayTotal = moneyAdapter.formatVND(order.total_amount);

                        return (
                          <div
                            key={order.id}
                            className="p-4 sm:p-5 hover:bg-[var(--card-muted)]/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[var(--foreground)]">
                                  #{order.id.slice(0, 8).toUpperCase()}
                                </span>
                                <StatusBadge status={order.status} />
                              </div>
                              <div className="text-xs text-[var(--subtext)] line-clamp-1">
                                Đơn hàng &bull; {new Date(order.created_at).toLocaleDateString("vi-VN")}
                              </div>
                              <div className="text-xs text-[var(--foreground)] font-medium">
                                {itemsCount} sản phẩm &bull; <span className="font-bold text-[var(--primary)]">{displayTotal}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:self-center">
                              <Link href="/seller/orders">
                                <Button variant="secondary" className="text-xs py-1.5 px-3">
                                  Xử lý đơn
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Low Stock Inventory (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-[var(--foreground)]">
                      Cảnh báo tồn kho
                    </h3>
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--warning-surface)] text-[var(--warning)]">
                      {lowStockProducts.length}
                    </span>
                  </div>
                  <Link
                    href="/seller/products"
                    className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
                  >
                    Quản lý kho &rarr;
                  </Link>
                </div>

                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                  {lowStockProducts.length === 0 ? (
                    <div className="p-8">
                      <EmptyState
                        icon="info"
                        title="Tồn kho an toàn"
                        description="Tất cả sản phẩm hiện đều có số lượng tồn kho trên mức tối thiểu."
                      />
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {lowStockProducts.map((prod) => (
                        <div
                          key={prod.product_id}
                          className="p-3.5 sm:p-4 hover:bg-[var(--card-muted)]/50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-[var(--foreground)] truncate">
                              {prod.product_name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  (prod.total_stock ?? 0) <= 5
                                    ? "bg-[var(--danger-surface)] text-[var(--danger)]"
                                    : "bg-[var(--warning-surface)] text-[var(--warning)]"
                                }`}
                              >
                                Tồn: {prod.total_stock}
                              </span>
                              <span className="text-xs text-[var(--subtext)]">
                                {moneyAdapter.formatVND(prod.min_price)}
                              </span>
                            </div>
                          </div>

                          <Link href="/seller/products">
                            <Button variant="secondary" className="text-xs py-1.5 px-3">
                              Cập nhật
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Seller Quick Action Cards */}
                <div className="bg-[var(--card-muted)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[var(--card)] text-[var(--primary)] shadow-sm">
                      <Icon name="grid" className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--foreground)]">Thêm sản phẩm mới</h4>
                      <p className="text-xs text-[var(--subtext)]">Mở rộng danh mục hàng hóa của bạn</p>
                    </div>
                  </div>
                  <Link href="/seller/products">
                    <Button variant="primary" className="text-xs py-1.5 px-3">
                      Tạo ngay
                    </Button>
                  </Link>
                </div>

                {/* Seller Wallet Quick Action */}
                <div className="bg-[var(--card-muted)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[var(--card)] text-[var(--success)] shadow-sm">
                      <Icon name="check" className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--foreground)]">Ví người bán & Rút tiền</h4>
                      <p className="text-xs text-[var(--subtext)]">Quản lý số dư khả dụng và yêu cầu rút về ngân hàng</p>
                    </div>
                  </div>
                  <Link href="/seller/wallet">
                    <Button variant="secondary" className="text-xs py-1.5 px-3">
                      Xem ví
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
