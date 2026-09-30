"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { StatusBadge, type OrderStatus } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextArea } from "@/components/ui/form-controls";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { repositories } from "@/lib/repositories/repository-factory";
import type { WireOrder } from "@/lib/api/order.api";

type SellerFilterTab = "ALL" | OrderStatus;

const SELLER_TABS: Array<{ key: SellerFilterTab; label: string }> = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_CONFIRMATION", label: "Chờ xác nhận" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "PREPARING", label: "Đang chuẩn bị" },
  { key: "SHIPPING", label: "Đang giao" },
  { key: "COMPLETED", label: "Hoàn tất" },
  { key: "CANCELLED", label: "Đã hủy" },
];

const SELLER_CANCEL_REASONS = [
  "Sản phẩm tạm thời hết hàng trong kho",
  "Phát hiện sản phẩm bị lỗi khi đóng gói",
  "Không thể liên hệ hoặc xác thực người nhận",
  "Khu vực giao hàng bị hạn chế vận chuyển",
  "Lý do khác",
] as const;

export function SellerOrdersScreen() {
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState<SellerFilterTab>("ALL");
  const [orders, setOrders] = useState<WireOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mutation loading states (tracked by order id)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Cancel dialog state
  const [cancellingOrder, setCancellingOrder] = useState<WireOrder | null>(null);
  const [cancelReason, setCancelReason] = useState<string>(SELLER_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderRepo = repositories.order();
      const list = await orderRepo.getOrders(
        activeTab === "ALL" ? undefined : { status: activeTab }
      );
      setOrders(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể tải danh sách đơn hàng.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    let isMounted = true;
    repositories
      .order()
      .getOrders(activeTab === "ALL" ? undefined : { status: activeTab })
      .then((list) => {
        if (isMounted) {
          setOrders(list);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách đơn hàng.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Handle Confirm Order (PENDING_CONFIRMATION -> CONFIRMED)
  const handleConfirmOrder = async (order: WireOrder) => {
    setActionLoadingId(order.id);
    try {
      const orderRepo = repositories.order();
      const updated = await orderRepo.confirmOrder(order.id, "Người bán xác nhận đơn hàng");
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(
        `Đã xác nhận đơn hàng ${updated.id.slice(0, 8)}`,
        "success",
        "Xác nhận thành công"
      );
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        showToast("Đơn hàng đã thay đổi trạng thái trước đó. Đang tải lại...", "error");
        fetchOrders();
      } else if (status === 403) {
        showToast("Bạn không có quyền xác nhận đơn hàng này.", "error");
      } else {
        const msg = err instanceof Error ? err.message : "Không thể xác nhận đơn hàng lúc này.";
        showToast(msg, "error");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Transition Order (e.g. CONFIRMED -> PREPARING -> SHIPPING)
  const handleTransitionOrder = async (order: WireOrder, targetStatus: OrderStatus) => {
    setActionLoadingId(order.id);
    try {
      const orderRepo = repositories.order();
      const updated = await orderRepo.transitionOrder(order.id, targetStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      const label = targetStatus === "PREPARING" ? "Bắt đầu chuẩn bị hàng" : "Bàn giao vận chuyển";
      showToast(
        `Đơn hàng ${updated.id.slice(0, 8)}: ${label}`,
        "success",
        "Cập nhật thành công"
      );
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        showToast("Xung đột trạng thái đơn hàng. Đang tải lại dữ liệu...", "error");
        fetchOrders();
      } else {
        const msg = err instanceof Error ? err.message : "Chuyển trạng thái thất bại.";
        showToast(msg, "error");
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  // Submit Cancel Order by Seller
  const handleConfirmCancel = async () => {
    if (!cancellingOrder) return;
    setCancelError(null);

    const finalReason =
      cancelReason === "Lý do khác" ? customReason.trim() : cancelReason.trim();

    if (!finalReason) {
      setCancelError("Vui lòng cung cấp lý do hủy đơn.");
      return;
    }

    setIsSubmittingCancel(true);
    try {
      const orderRepo = repositories.order();
      const updated = await orderRepo.transitionOrder(
        cancellingOrder.id,
        "CANCELLED",
        finalReason
      );
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      showToast(
        `Đã hủy đơn hàng ${updated.id.slice(0, 8)}`,
        "info",
        "Hủy đơn hoàn tất"
      );
      setCancellingOrder(null);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        setCancelError("Đơn hàng đã đổi trạng thái, không thể hủy. Đang làm mới...");
        setTimeout(() => {
          fetchOrders();
          setCancellingOrder(null);
        }, 1500);
      } else {
        const msg = err instanceof Error ? err.message : "Không thể hủy đơn hàng.";
        setCancelError(msg);
      }
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Calculate fulfillment queue stats
  const pendingCount = orders.filter((o) => o.status === "PENDING_CONFIRMATION").length;
  const preparingCount = orders.filter((o) => o.status === "PREPARING").length;
  const shippingCount = orders.filter((o) => o.status === "SHIPPING").length;

  return (
    <ProtectedPage allowedRoles={["SELLER", "ADMIN"]}>
      <div className="seller-orders-page max-w-6xl mx-auto space-y-6 pb-24">
        {/* Page Header */}
        <header className="page-heading">
          <div>
            <p className="eyebrow">Kênh người bán Dino</p>
            <h1 className="page-title">Xử Lý & Giao Hàng</h1>
            <p className="page-description">
              Theo dõi đơn hàng cần chuẩn bị, xác nhận đơn và điều phối giao hàng tuần tự.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/seller/products"
              className="button button--secondary h-10 px-4 text-xs font-semibold"
            >
              <Icon name="grid" className="w-4 h-4" />
              <span>Quản lý sản phẩm</span>
            </Link>
          </div>
        </header>

        {/* Sub-navigation tabs between Orders and Products */}
        <nav aria-label="Điều hướng kênh người bán" className="border-b border-[var(--border)]">
          <div className="flex gap-6 text-sm font-semibold">
            <Link
              href="/seller/orders"
              className="pb-3 border-b-2 border-[var(--primary-active)] text-[var(--primary-active)]"
              aria-current="page"
            >
              Đơn hàng cần xử lý
            </Link>
            <Link
              href="/seller/products"
              className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
            >
              Danh sách sản phẩm
            </Link>
          </div>
        </nav>

        {/* Quick Queue Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-[var(--warning-border)]">
            <div>
              <p className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                Chờ xác nhận
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-[var(--warning-text)]">
                {pendingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--warning-surface)] flex items-center justify-center text-[var(--warning-text)]">
              <Icon name="bag" className="w-5 h-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-[var(--primary-border)]">
            <div>
              <p className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                Đang chuẩn bị hàng
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-[var(--primary-active)]">
                {preparingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--primary-surface)] flex items-center justify-center text-[var(--primary-active)]">
              <Icon name="grid" className="w-5 h-5" />
            </div>
          </div>

          <div className="surface-card p-4 flex items-center justify-between border-l-4 border-l-[var(--success)]">
            <div>
              <p className="text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                Đang vận chuyển
              </p>
              <p className="text-2xl font-bold mt-1 tabular-nums text-[var(--success-text)]">
                {shippingCount}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-[var(--success-surface)] flex items-center justify-center text-[var(--success-text)]">
              <Icon name="check" className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <nav aria-label="Bộ lọc trạng thái đơn hàng của người bán" className="overflow-x-auto pb-1 -mx-2 px-2">
          <div className="filter-tabs w-max min-w-full sm:w-auto">
            {SELLER_TABS.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className="filter-tab whitespace-nowrap"
                  aria-pressed={isSelected}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content Area */}
        {isLoading ? (
          <div className="surface-card p-6 space-y-4" aria-busy="true">
            <Skeleton height={24} className="w-1/4" />
            <Skeleton height={50} />
            <Skeleton height={50} />
            <Skeleton height={50} />
          </div>
        ) : error ? (
          <ErrorState
            title="Không thể tải đơn hàng của gian hàng"
            description={error}
            onRetry={fetchOrders}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="bag"
            title="Không có đơn hàng nào"
            description={
              activeTab === "ALL"
                ? "Gian hàng của bạn hiện chưa phát sinh đơn hàng nào."
                : "Không có đơn hàng nào trong trạng thái đã chọn."
            }
          />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="surface-card overflow-hidden hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Mã Đơn / Ngày Tạo</th>
                      <th className="py-3 px-4">Sản Phẩm</th>
                      <th className="py-3 px-4 text-right">Tổng Tiền</th>
                      <th className="py-3 px-4 text-center">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Thao Tác Xử Lý</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {orders.map((order) => {
                      const isPending = order.status === "PENDING_CONFIRMATION";
                      const isConfirmed = order.status === "CONFIRMED";
                      const isPreparing = order.status === "PREPARING";
                      const isShipping = order.status === "SHIPPING";
                      const isBusy = actionLoadingId === order.id;

                      const formattedDate = order.created_at
                        ? new Date(order.created_at).toLocaleDateString("vi-VN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : "Vừa xong";

                      return (
                        <tr key={order.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                          <td className="py-4 px-4 align-top">
                            <span className="font-mono font-bold text-xs text-[var(--foreground)] block">
                              {order.id.slice(0, 8)}
                            </span>
                            <span className="text-xs text-[var(--subtext)] mt-0.5 block">
                              {formattedDate}
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top max-w-xs">
                            {order.items && order.items.length > 0 ? (
                              <div className="space-y-1">
                                {order.items.map((item) => (
                                  <div key={item.id} className="text-xs">
                                    <span className="font-medium text-[var(--foreground)] line-clamp-1">
                                      {item.product_name}
                                    </span>
                                    <span className="text-[var(--subtext)]">
                                      {item.variant_name} × {item.quantity}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--subtext)] italic">
                                Chi tiết đang tải...
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 align-top text-right tabular-nums">
                            <strong className="text-sm font-bold text-[var(--foreground)]">
                              {moneyAdapter.formatVND(order.total_amount)}
                            </strong>
                            <span className="text-xs text-[var(--success)] block mt-0.5">
                              Free Ship (0₫)
                            </span>
                          </td>

                          <td className="py-4 px-4 align-top text-center">
                            <StatusBadge status={order.status} />
                          </td>

                          <td className="py-4 px-4 align-top text-right space-x-2">
                            {/* Step 1: PENDING_CONFIRMATION -> CONFIRMED */}
                            {isPending && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="primary"
                                  className="text-xs py-1.5 px-3 min-h-[36px]"
                                  loading={isBusy}
                                  onClick={() => handleConfirmOrder(order)}
                                >
                                  Xác nhận đơn
                                </Button>
                                <Button
                                  variant="danger"
                                  className="text-xs py-1.5 px-2.5 min-h-[36px]"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setCancellingOrder(order);
                                    setCancelError(null);
                                  }}
                                >
                                  Từ chối
                                </Button>
                              </div>
                            )}

                            {/* Step 2: CONFIRMED -> PREPARING */}
                            {isConfirmed && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="primary"
                                  className="text-xs py-1.5 px-3 min-h-[36px]"
                                  loading={isBusy}
                                  onClick={() => handleTransitionOrder(order, "PREPARING")}
                                >
                                  Chuẩn bị hàng
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="text-xs py-1.5 px-2.5 text-[var(--danger)] min-h-[36px]"
                                  disabled={isBusy}
                                  onClick={() => {
                                    setCancellingOrder(order);
                                    setCancelError(null);
                                  }}
                                >
                                  Hủy
                                </Button>
                              </div>
                            )}

                            {/* Step 3: PREPARING -> SHIPPING */}
                            {isPreparing && (
                              <Button
                                variant="primary"
                                className="text-xs py-1.5 px-3 min-h-[36px]"
                                loading={isBusy}
                                onClick={() => handleTransitionOrder(order, "SHIPPING")}
                              >
                                Giao cho vận chuyển
                              </Button>
                            )}

                            {/* Step 4: SHIPPING (Read only for seller, terminal rule QD11) */}
                            {isShipping && (
                              <span className="text-xs text-[var(--subtext)] italic block py-1">
                                Đang vận chuyển
                              </span>
                            )}

                            {order.status === "COMPLETED" && (
                              <span className="text-xs text-[var(--success)] font-medium block py-1">
                                Đã giao thành công
                              </span>
                            )}

                            {order.status === "CANCELLED" && (
                              <span className="text-xs text-[var(--danger)] font-medium block py-1">
                                Đã hủy đơn
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="space-y-4 md:hidden">
              {orders.map((order) => {
                const isPending = order.status === "PENDING_CONFIRMATION";
                const isConfirmed = order.status === "CONFIRMED";
                const isPreparing = order.status === "PREPARING";
                const isShipping = order.status === "SHIPPING";
                const isBusy = actionLoadingId === order.id;

                return (
                  <article key={order.id} className="surface-card p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                      <div>
                        <span className="font-mono font-bold text-xs text-[var(--foreground)]">
                          {order.id.slice(0, 8)}
                        </span>
                        <time className="text-xs text-[var(--subtext)] block">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString("vi-VN") : ""}
                        </time>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    {order.items && order.items.length > 0 && (
                      <div className="text-xs space-y-1">
                        {order.items.map((it) => (
                          <div key={it.id} className="flex justify-between">
                            <span className="font-medium line-clamp-1">{it.product_name}</span>
                            <span className="text-[var(--subtext)] tabular-nums shrink-0">
                              {it.quantity} × {moneyAdapter.formatVND(it.price)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-baseline pt-2 border-t border-[var(--border)] text-sm">
                      <span className="text-xs text-[var(--subtext)]">Tổng tiền:</span>
                      <strong className="text-base text-[var(--primary-active)] font-bold tabular-nums">
                        {moneyAdapter.formatVND(order.total_amount)}
                      </strong>
                    </div>

                    {/* Mobile Action Buttons */}
                    <div className="pt-2 flex justify-end gap-2">
                      {isPending && (
                        <>
                          <Button
                            variant="danger"
                            className="text-xs py-2 px-3"
                            disabled={isBusy}
                            onClick={() => {
                              setCancellingOrder(order);
                              setCancelError(null);
                            }}
                          >
                            Từ chối
                          </Button>
                          <Button
                            variant="primary"
                            className="text-xs py-2 px-4"
                            loading={isBusy}
                            onClick={() => handleConfirmOrder(order)}
                          >
                            Xác nhận đơn
                          </Button>
                        </>
                      )}

                      {isConfirmed && (
                        <Button
                          variant="primary"
                          className="text-xs py-2 px-4"
                          loading={isBusy}
                          onClick={() => handleTransitionOrder(order, "PREPARING")}
                        >
                          Bắt đầu chuẩn bị hàng
                        </Button>
                      )}

                      {isPreparing && (
                        <Button
                          variant="primary"
                          className="text-xs py-2 px-4"
                          loading={isBusy}
                          onClick={() => handleTransitionOrder(order, "SHIPPING")}
                        >
                          Bàn giao vận chuyển
                        </Button>
                      )}

                      {isShipping && (
                        <span className="text-xs text-[var(--subtext)] italic">
                          Đang giao đến người mua
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancel / Reject Modal for Seller */}
        <Dialog
          open={Boolean(cancellingOrder)}
          onOpenChange={(open) => {
            if (!open && !isSubmittingCancel) setCancellingOrder(null);
          }}
          title="Từ chối / Hủy đơn hàng"
          description={`Mã đơn hàng: ${cancellingOrder?.id}`}
          footer={
            <div className="flex justify-end gap-3 w-full">
              <Button
                variant="ghost"
                disabled={isSubmittingCancel}
                onClick={() => setCancellingOrder(null)}
              >
                Quay lại
              </Button>
              <Button
                variant="danger"
                loading={isSubmittingCancel}
                onClick={handleConfirmCancel}
              >
                Xác nhận từ chối đơn
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {cancelError && (
              <div className="notice notice--warning" role="alert">
                <Icon name="warning" />
                <p className="text-xs">{cancelError}</p>
              </div>
            )}

            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold text-[var(--foreground)] mb-2">
                Chọn lý do từ chối xử lý đơn hàng này:
              </legend>
              {SELLER_CANCEL_REASONS.map((rsn) => (
                <label
                  key={rsn}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    cancelReason === rsn
                      ? "border-[var(--primary-active)] bg-[var(--primary-surface)] text-[var(--foreground)] font-medium"
                      : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)] text-[var(--foreground)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="seller_cancel_reason"
                    value={rsn}
                    checked={cancelReason === rsn}
                    onChange={() => {
                      setCancelReason(rsn);
                      setCancelError(null);
                    }}
                    className="accent-[var(--primary-active)]"
                  />
                  <span>{rsn}</span>
                </label>
              ))}
            </fieldset>

            {cancelReason === "Lý do khác" && (
              <FormField
                id="seller-custom-reason"
                label="Lý do cụ thể khác"
                required
                error={cancelError && !customReason.trim() ? "Vui lòng nhập lý do." : undefined}
              >
                <TextArea
                  id="seller-custom-reason"
                  placeholder="Nhập lý do người bán không thể xử lý đơn..."
                  rows={3}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                />
              </FormField>
            )}

            <p className="text-xs text-[var(--subtext)]">
              Lưu ý: Hủy đơn sẽ thông báo trực tiếp tới người mua và số lượng tồn kho sẽ không bị trừ.
            </p>
          </div>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
