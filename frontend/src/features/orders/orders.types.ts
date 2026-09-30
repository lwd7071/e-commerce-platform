import type { OrderStatus } from "@/components/ui/status-badge";
import type { WireOrder, WireOrderItem } from "@/lib/api/order.api";

export type { OrderStatus, WireOrder, WireOrderItem };

export type OrderFilterTab = "ALL" | OrderStatus;

export interface TabConfig {
  key: OrderFilterTab;
  label: string;
}

export const ORDER_TABS: TabConfig[] = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING_CONFIRMATION", label: "Chờ xác nhận" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "PREPARING", label: "Đang chuẩn bị" },
  { key: "SHIPPING", label: "Đang giao" },
  { key: "COMPLETED", label: "Hoàn thành" },
  { key: "CANCELLED", label: "Đã hủy" },
  { key: "DELIVERY_FAILED", label: "Giao thất bại" },
];

export const PREDEFINED_CANCEL_REASONS = [
  "Tôi muốn thay đổi địa chỉ nhận hàng",
  "Tôi muốn thay đổi sản phẩm hoặc số lượng",
  "Tôi muốn áp dụng mã giảm giá khác",
  "Tìm thấy giá tốt hơn ở nơi khác",
  "Đổi ý, không muốn mua nữa",
  "Lý do khác",
] as const;
