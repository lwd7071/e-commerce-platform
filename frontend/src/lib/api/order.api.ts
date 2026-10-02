import { apiClient } from "./client";
import type { OrderStatus } from "@/components/ui/status-badge";
import type { components } from "./generated/openapi";
import type { PaginatedEnvelope } from "./types";

/** Backend read contract. Components consume the mapped OrderViewModel below. */
export type OrderReadDTO = components["schemas"]["OrderReadDTO"];

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
  order_code?: string;
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
  status_history?: Array<{ history_id: string; old_status: string | null; new_status: string; changed_by: string | null; reason: string | null; changed_at: string }>;
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
    status_history: dto.status_history,
  };
}

export const orderApi = {
  getOrdersPaginated: async (params?: { status?: string; limit?: number; cursor?: string }): Promise<PaginatedEnvelope<WireOrder>> => {
    const page = await apiClient.getPaginated<OrderReadDTO>("/orders", { params });
    return { ...page, data: page.data.map(mapOrder) };
  },
  getOrders: async (params?: { status?: string }) => (await orderApi.getOrdersPaginated({ ...params, limit: 100 })).data,
  getOrderById: async (id: string) => mapOrder(await apiClient.get<OrderReadDTO>(`/orders/${id}`)),
  cancelOrder: async (id: string, reason: string) => { await apiClient.post<unknown>(`/orders/${id}/cancel`, { reason }); return orderApi.getOrderById(id); },
  confirmOrder: async (id: string, reason?: string) => { await apiClient.post<unknown>(`/orders/${id}/confirm`, { reason }); return orderApi.getOrderById(id); },
  confirmReceived: async (id: string) => { await apiClient.post<unknown>(`/orders/${id}/confirm-received`, {}); return orderApi.getOrderById(id); },
  transitionOrder: async (id: string, data: { to: string; reason?: string; shipment_status?: string }) => {
    const payload = {
      ...data,
      ...(data.to === 'SHIPPING' && !data.shipment_status ? { shipment_status: 'HANDED_OVER' } : {}),
    };
    await apiClient.post<unknown>(`/orders/${id}/transition`, payload);
    return orderApi.getOrderById(id);
  },
  retryPayment: (id: string, data: { payment_method: string }) => apiClient.post<unknown>(`/orders/${id}/payments`, data),
};
