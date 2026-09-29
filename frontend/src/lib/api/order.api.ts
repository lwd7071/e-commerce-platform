import { apiClient } from "./client";
import type { OrderStatus } from "@/components/ui/status-badge";

/** Backend read contract. Components consume the mapped OrderViewModel below. */
export interface OrderReadDTO {
  order_id: string;
  buyer_id: string;
  shop_id: string;
  shop_name: string;
  status: OrderStatus;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  total_amount: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  items: Array<{
    order_item_id: string;
    product_id: string;
    variant_id: string;
    product_name: string;
    variant_name: string;
    unit_price: string;
    quantity: number;
    line_total: string;
    image_url: string | null;
  }>;
}

export interface WireOrderItem {
  id: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  variant_name: string;
  price: string;
  quantity: number;
  subtotal: string;
  image_url?: string | null;
}

/** Stable UI model produced at the API boundary; no backend DTO is consumed in components. */
export interface WireOrder {
  id: string;
  buyer_id: string;
  shop_id: string;
  shop_name: string;
  status: OrderStatus;
  subtotal?: string;
  total_amount: string;
  shipping_fee: string;
  discount_amount: string;
  cancel_reason?: string | null;
  created_at: string;
  updated_at?: string;
  items: WireOrderItem[];
}

function mapOrder(dto: OrderReadDTO): WireOrder {
  return {
    id: dto.order_id,
    buyer_id: dto.buyer_id,
    shop_id: dto.shop_id,
    shop_name: dto.shop_name,
    status: dto.status,
    subtotal: dto.subtotal,
    total_amount: dto.total_amount,
    shipping_fee: dto.shipping_fee,
    discount_amount: dto.discount_amount,
    cancel_reason: dto.cancel_reason,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
    items: dto.items.map(item => ({
      id: item.order_item_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.product_name,
      variant_name: item.variant_name,
      price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.line_total,
      image_url: item.image_url,
    })),
  };
}

export const orderApi = {
  getOrders: async (params?: { status?: string }) => (await apiClient.get<OrderReadDTO[]>("/orders", { params })).map(mapOrder),
  getOrderById: async (id: string) => mapOrder(await apiClient.get<OrderReadDTO>(`/orders/${id}`)),
  cancelOrder: async (id: string, reason: string) => { await apiClient.post<unknown>(`/orders/${id}/cancel`, { reason }); return orderApi.getOrderById(id); },
  confirmOrder: async (id: string, reason?: string) => { await apiClient.post<unknown>(`/orders/${id}/confirm`, { reason }); return orderApi.getOrderById(id); },
  transitionOrder: async (id: string, data: { to: string; reason?: string }) => { await apiClient.post<unknown>(`/orders/${id}/transition`, data); return orderApi.getOrderById(id); },
  retryPayment: (id: string, data: { payment_method: string }) => apiClient.post<unknown>(`/orders/${id}/payments`, data),
};
