"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/data-states";
import { Icon } from "@/components/ui/icon";
import { repositories } from "@/lib/repositories/repository-factory";
import { ORDER_TABS, type OrderFilterTab, type WireOrder } from "./orders.types";
import { OrderCard } from "./order-card";
import { CancelOrderDialog } from "./cancel-order-dialog";

export function OrdersScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createdIdsParam = searchParams.get("created");

  const [activeTab, setActiveTab] = useState<OrderFilterTab>(() => {
    return createdIdsParam ? "PENDING_CONFIRMATION" : "ALL";
  });

  const [orders, setOrders] = useState<WireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cancellingOrder, setCancellingOrder] = useState<WireOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: "success" | "error" | "info";
    title: string;
    message: string;
  } | null>(null);

  const [, startTransition] = useTransition();

  // Parse highlighted IDs from URL
  const createdOrderIds = createdIdsParam ? createdIdsParam.split(",") : [];

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orderRepo = repositories.order();
      const list = await orderRepo.getOrders(
        activeTab === "ALL" ? undefined : { status: activeTab }
      );
      setOrders(list);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể tải danh sách đơn hàng.";
      setError(message);
    } finally {
      setLoading(false);
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
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không thể tải danh sách đơn hàng.");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // Handle successful cancellation
  const handleCancelSuccess = (updated: WireOrder) => {
    setOrders((prev) =>
      prev.map((ord) => (ord.id === updated.id ? updated : ord))
    );
    setToastMessage({
      type: "success",
      title: "Hủy đơn hàng thành công",
      message: `Đơn hàng ${updated.id.slice(0, 8)} đã được hủy và hoàn lại tồn kho.`,
    });
    // Auto dismiss toast after 4s
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Handle Buyer confirming receipt (P0-08 / C-103)
  const handleConfirmReceived = async (order: WireOrder) => {
    try {
      const orderRepo = repositories.order();
      let updated: WireOrder;
      if (orderRepo.confirmReceived) {
        updated = await orderRepo.confirmReceived(order.id);
      } else {
        updated = { ...order, status: "COMPLETED" };
      }
      setOrders((prev) =>
        prev.map((ord) => (ord.id === order.id ? { ...ord, status: "COMPLETED" } : ord))
      );
      setToastMessage({
        type: "success",
        title: "Xác nhận nhận hàng thành công",
        message: `Đơn hàng ${order.id.slice(0, 8)} đã hoàn tất! Bạn có thể viết đánh giá sản phẩm ngay bây giờ.`,
      });
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Không thể xác nhận nhận hàng.";
      setToastMessage({
        type: "error",
        title: "Xác nhận nhận hàng thất bại",
        message,
      });
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    }
  };

  return (
    <ProtectedPage allowedRoles={["BUYER"]}>
      <div className="orders-page max-w-4xl mx-auto space-y-6 pb-24">
        {/* Page Heading */}
        <header className="page-heading">
          <div>
            <p className="eyebrow">Dino Buyer Center</p>
            <h1 className="page-title">Đơn hàng của tôi</h1>
            <p className="page-description">
              Theo dõi tình trạng đơn hàng, lộ trình vận chuyển và quản lý yêu cầu hủy đơn thuận tiện.
            </p>
          </div>
        </header>

        {/* Newly created order banner */}
        {createdOrderIds.length > 0 && (
          <div className="p-4 rounded-xl bg-[var(--success-surface)] border border-[var(--success-border)] flex items-start gap-3 text-sm text-[var(--success-text)]">
            <Icon name="check" className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="block font-semibold">Đặt hàng thành công!</strong>
              <span>
                Cảm ơn bạn đã mua hàng. Đơn hàng mới của bạn đang được người bán chuẩn bị.
              </span>
            </div>
            <button
              type="button"
              className="text-xs font-semibold hover:underline"
              onClick={() => {
                startTransition(() => {
                  router.replace("/orders");
                });
              }}
              aria-label="Đóng thông báo"
            >
              ✕
            </button>
          </div>
        )}

        {/* Filter Tabs Bar (Horizontal scrolling on mobile) */}
        <nav aria-label="Bộ lọc trạng thái đơn hàng" className="overflow-x-auto pb-1 -mx-2 px-2">
          <div className="filter-tabs w-max min-w-full sm:w-auto">
            {ORDER_TABS.map((tab) => {
              const isSelected = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className="filter-tab whitespace-nowrap"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setActiveTab(tab.key);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content Area */}
        {loading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Đang tải danh sách đơn hàng">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="surface-card p-5 space-y-3">
                <Skeleton height={20} className="w-1/3" />
                <Skeleton height={60} />
                <Skeleton height={30} className="w-1/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <ErrorState
            title="Chưa tải được danh sách đơn hàng"
            description={error}
            onRetry={fetchOrders}
          />
        ) : orders.length === 0 ? (
          <EmptyState
            icon="bag"
            title="Không tìm thấy đơn hàng nào"
            description={
              activeTab === "ALL"
                ? "Bạn chưa có đơn hàng nào tại Dino. Hãy khám phá và mua sắm ngay hôm nay!"
                : "Không có đơn hàng nào trong trạng thái này."
            }
            action={{
              label: "Khám phá sản phẩm",
              onClick: () => router.push("/products"),
            }}
          />
        ) : (
          <div className="space-y-4" role="feed" aria-label="Danh sách đơn hàng">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isHighlighted={createdOrderIds.includes(order.id)}
                onCancel={(ord) => setCancellingOrder(ord)}
                onConfirmReceived={handleConfirmReceived}
              />
            ))}
          </div>
        )}

        {/* Cancel Order Dialog Modal */}
        <CancelOrderDialog
          order={cancellingOrder}
          onClose={() => setCancellingOrder(null)}
          onSuccess={handleCancelSuccess}
          onConflictRefresh={fetchOrders}
        />

        {/* Toast Region */}
        {toastMessage && (
          <div className="toast-region" role="region" aria-label="Thông báo hệ thống">
            <div className={`toast toast--${toastMessage.type}`} role="status">
              <Icon
                name={
                  toastMessage.type === "success"
                    ? "check"
                    : toastMessage.type === "error"
                    ? "warning"
                    : "info"
                }
              />
              <div className="toast__message">
                <span className="toast__title">{toastMessage.title}</span>
                <span>{toastMessage.message}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedPage>
  );
}
