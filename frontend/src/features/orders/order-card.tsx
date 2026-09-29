"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import type { WireOrder } from "./orders.types";

interface OrderCardProps {
  order: WireOrder;
  onCancel: (order: WireOrder) => void;
  isHighlighted?: boolean;
}

export function OrderCard({ order, onCancel, isHighlighted = false }: OrderCardProps) {
  const formattedDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Vừa xong";

  const isPending = order.status === "PENDING_CONFIRMATION";
  const isCompleted = order.status === "COMPLETED";
  const isCancelled = order.status === "CANCELLED";

  return (
    <article
      className={`surface-card p-5 space-y-4 transition-all ${
        isHighlighted
          ? "ring-2 ring-[var(--primary-active)] bg-[var(--primary-surface)]/20"
          : ""
      }`}
      aria-labelledby={`order-heading-${order.id}`}
    >
      {/* 1. Header: Shop Name, Order Code, Date & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[var(--card-muted)] border border-[var(--border)] flex items-center justify-center text-[var(--subtext)]">
            <Icon name="bag" className="w-4 h-4" />
          </div>
          <div>
            <h2 id={`order-heading-${order.id}`} className="font-semibold text-sm text-[var(--foreground)]">
              {order.shop_name || "Gian hàng Dino"}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--subtext)]">
              <span>Mã đơn: <strong className="font-mono text-[var(--foreground)]">{order.id.slice(0, 8)}</strong></span>
              <span>•</span>
              <time dateTime={order.created_at}>{formattedDate}</time>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* 2. Order Items List */}
      <div className="divide-y divide-[var(--border)]">
        {order.items && order.items.length > 0 ? (
          order.items.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-12 h-12 rounded-lg bg-[var(--card-muted)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--subtext)]">
                  <Icon name="bag" className="w-5 h-5 opacity-40" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm text-[var(--foreground)] line-clamp-1">
                    {item.product_name}
                  </h3>
                  <p className="text-xs text-[var(--subtext)] mt-0.5">
                    Phân loại: {item.variant_name}
                  </p>
                  <p className="text-xs text-[var(--subtext)]">
                    Số lượng: <strong className="text-[var(--foreground)]">{item.quantity}</strong> × {moneyAdapter.formatVND(item.price)}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-semibold tabular-nums text-sm">
                  {moneyAdapter.formatVND(item.subtotal)}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-3 text-xs text-[var(--subtext)] italic">
            Thông tin chi tiết sản phẩm đang được cập nhật.
          </div>
        )}
      </div>

      {/* 3. Reason Alert (If cancelled) */}
      {isCancelled && order.cancel_reason && (
        <div className="p-3 bg-[var(--danger-surface)] border border-[var(--danger-border)] rounded-lg text-xs text-[var(--danger-text)]">
          <span className="font-semibold">Lý do hủy đơn: </span>
          <span>{order.cancel_reason}</span>
        </div>
      )}

      {/* 4. Footer: Summary & Actions */}
      <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-[var(--subtext)] space-y-0.5">
          <div className="flex items-center gap-2">
            <span>Vận chuyển:</span>
            <span className="text-[var(--success)] font-semibold">0 ₫ (Miễn phí)</span>
            {moneyAdapter.toInteger(order.discount_amount) > 0 && (
              <>
                <span>•</span>
                <span>Giảm giá:</span>
                <span className="text-[var(--success)] font-semibold">
                  -{moneyAdapter.formatVND(order.discount_amount)}
                </span>
              </>
            )}
          </div>
          <div className="text-sm">
            <span>Tổng thanh toán: </span>
            <strong className="text-base text-[var(--primary-active)] font-bold tabular-nums">
              {moneyAdapter.formatVND(order.total_amount)}
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Action 1: Hủy đơn nếu đơn đang chờ xác nhận */}
          {isPending && (
            <Button
              variant="danger"
              className="text-xs py-2 px-3.5"
              onClick={() => onCancel(order)}
            >
              Hủy đơn hàng
            </Button>
          )}

          {/* Action 2: Đánh giá sản phẩm nếu đơn đã hoàn thành */}
          {isCompleted && (
            <Link
              href={`/orders/${order.id}/review`}
              className="button button--secondary text-xs py-2 px-3.5"
            >
              Đánh giá sản phẩm
            </Link>
          )}

          {/* Action 3: Nút xem lại chi tiết / mua lại */}
          <Link
            href="/products"
            className="button button--ghost text-xs py-2 px-3 text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Mua lại
          </Link>
        </div>
      </div>
    </article>
  );
}
