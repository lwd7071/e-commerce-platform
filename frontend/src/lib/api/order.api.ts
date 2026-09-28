import { apiClient } from "./client";
import type { OrderStatus } from "@/components/ui/status-badge";

export interface WireOrderItem {
  id: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  variant_name: string;
  price: string;
  quantity: number;
  subtotal: string;
  image_url?: string;
}

export interface WireOrder {
  id: string;
  order_code: string;
  buyer_id: string;
  shop_id: string;
  shop_name?: string;
  status: OrderStatus;
  total_amount: string;
  shipping_fee: string;
  discount_amount: string;
  final_amount: string;
  cancel_reason?: string | null;
  created_at: string;
  items?: WireOrderItem[];
}

export const orderApi = {
  getOrders: (params?: { status?: string; shop_id?: string }) => apiClient.get<WireOrder[]>("/orders", { params }),
  getOrderById: (id: string) => apiClient.get<WireOrder>(`/orders/${id}`),

  cancelOrder: (id: string, reason: string) =>
    apiClient.post<WireOrder>(`/orders/${id}/cancel`, { reason }),

  confirmOrder: (id: string, reason?: string) =>
    apiClient.post<WireOrder>(`/orders/${id}/confirm`, { reason }),

  transitionOrder: (id: string, data: { to: string; reason?: string }) =>
    apiClient.post<WireOrder>(`/orders/${id}/transition`, data),

  retryPayment: (id: string, data: { payment_method: string }) =>
    apiClient.post<unknown>(`/orders/${id}/payments`, data),
};
