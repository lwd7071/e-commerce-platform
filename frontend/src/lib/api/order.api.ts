import { apiClient } from "./client";

export interface WireOrder {
  id: string;
  order_code: string;
  buyer_id: string;
  shop_id: string;
  status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "COMPLETED" | "CANCELLED";
  total_amount: string;
  shipping_fee: string;
  discount_amount: string;
  final_amount: string;
  created_at: string;
  items?: Array<{
    id: string;
    product_name: string;
    variant_name: string;
    price: string;
    quantity: number;
    subtotal: string;
  }>;
}

export const orderApi = {
  getOrders: (params?: { status?: string }) => apiClient.get<WireOrder[]>("/orders", { params }),
  getOrderById: (id: string) => apiClient.get<WireOrder>(`/orders/${id}`),

  confirmOrder: (id: string, reason?: string) =>
    apiClient.post<WireOrder>(`/orders/${id}/confirm`, { reason }),

  transitionOrder: (id: string, data: { to: string; reason?: string }) =>
    apiClient.post<WireOrder>(`/orders/${id}/transition`, data),

  retryPayment: (id: string, data: { payment_method: string }) =>
    apiClient.post<unknown>(`/orders/${id}/payments`, data),
};
