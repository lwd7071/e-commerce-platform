export type OrderStatus = "PENDING_CONFIRMATION" | "CONFIRMED" | "PREPARING" | "SHIPPING" | "COMPLETED" | "CANCELLED" | "DELIVERY_FAILED";

const labels: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  SHIPPING: "Đang giao",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  DELIVERY_FAILED: "Giao thất bại",
};

const styles: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  SHIPPING: "shipping",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  DELIVERY_FAILED: "failed",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`status-badge status-badge--${styles[status]}`}><span className="status-badge__dot" aria-hidden="true" />{labels[status]}</span>;
}
