import { apiClient } from "./client";
import type { components } from "./generated/openapi";

export type WireProfile = Pick<components["schemas"]["ProfileDTO"], "full_name" | "phone" | "avatar_url"> & Partial<components["schemas"]["ProfileDTO"]> & {
  id?: string;
  email?: string;
  role?: "BUYER" | "SELLER" | "ADMIN";
};

export type WireNotification = components["schemas"]["NotificationDTO"];

/**
 * Address DTO matching runtime PgAddressRepository (camelCase).
 */
export type WireAddress = Omit<components["schemas"]["AddressDTO"], "userId" | "createdAt" | "updatedAt"> &
  Partial<Pick<components["schemas"]["AddressDTO"], "userId" | "createdAt" | "updatedAt">>;

export type UpdateAddressPayload = Partial<Omit<CreateAddressPayload, "isDefault">> & { isDefault?: boolean };

/**
 * Address creation payload (pure camelCase per Ponytail guidelines).
 */
export interface CreateAddressPayload {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault?: boolean;
}

/**
 * Cart Item DTO matching runtime PgCartRepository (snake_case).
 */
export interface WireCartItem {
  cart_item_id: string;
  variant_id: string;
  quantity: number;
  is_selected: boolean;
}

/**
 * Full cart representation returned by GET /cart.
 */
export interface WireCart {
  cart_id: string | null;
  buyer_id: string;
  items: WireCartItem[];
}

/**
 * Single cart item response returned by POST /cart/items (201) and PATCH /cart/items/:id (200).
 */
export interface WireCartItemResponse {
  cart_item_id: string;
  variant_id: string;
  quantity: number;
  is_selected: boolean;
}

/**
 * Whitelist payload for POST /cart/items:
 * Only { variant_id, quantity }. Do NOT send is_selected or extra fields (triggers 422 Unknown field).
 * Note: addToCart is relative accumulation (ON CONFLICT DO UPDATE SET quantity = quantity + EXCLUDED.quantity),
 * whereas updateCartItem sets the absolute quantity.
 */
export interface AddToCartPayload {
  variant_id: string;
  quantity: number;
}

/**
 * Whitelist payload for PATCH /cart/items/:id:
 * Must provide at least one of quantity (>= 1) or is_selected.
 */
export interface UpdateCartItemPayload {
  quantity?: number;
  isSelected?: boolean;
  is_selected?: boolean;
}

export const buyerApi = {
  getProfile: () => apiClient.get<WireProfile>("/profile"),
  updateProfile: (data: { full_name?: string | null; phone?: string | null; avatar_url?: string | null }) => apiClient.patch<WireProfile>("/profile", { full_name: data.full_name, phone: data.phone }),
  updateAvatar: (mediaId: string) => apiClient.patch<WireProfile>("/profile/avatar", { media_id: mediaId }),

  // Address operations (AVAILABLE in runtime at /addresses)
  getAddresses: () => apiClient.get<WireAddress[]>("/addresses"),
  createAddress: (data: CreateAddressPayload) => apiClient.post<WireAddress>("/addresses", data),
  getAddress: (id: string) => apiClient.get<WireAddress>(`/addresses/${id}`),
  updateAddress: (id: string, data: UpdateAddressPayload) => apiClient.patch<WireAddress>(`/addresses/${id}`, data),
  deleteAddress: (id: string) => apiClient.delete<void>(`/addresses/${id}`),
  setDefaultAddress: (id: string) => apiClient.patch<{ message: string }>(`/addresses/${id}/default`, {}),

  // Cart operations (AVAILABLE in runtime at /cart/*)
  getCart: () => apiClient.get<WireCart>("/cart"),
  addToCart: (data: AddToCartPayload) => apiClient.post<WireCartItemResponse>("/cart/items", data),
  updateCartItem: (itemId: string, data: UpdateCartItemPayload) => {
    // Client-side guard ensuring quantity >= 1 (async reject)
    if (data.quantity !== undefined && data.quantity < 1) {
      return Promise.reject(new Error("Số lượng sản phẩm trong giỏ phải >= 1"));
    }
    return apiClient.patch<WireCartItemResponse>(`/cart/items/${itemId}`, data);
  },
  removeCartItem: (itemId: string) => apiClient.delete<void>(`/cart/items/${itemId}`),
  removeSelectedCartItems: () => apiClient.delete<void>("/cart/selected"),

  // Notification operations (legacy scaffold code from Person 1, Person 2 owns domain)
  getNotifications: () => apiClient.get<WireNotification[]>("/notifications"),
  markNotificationRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),

  // Loyalty & DinoPoint operations
  getLoyalty: () => apiClient.get<BuyerLoyaltyInfo>("/buyer/loyalty"),
  getLoyaltyHistory: (params?: { page?: number; limit?: number }) => apiClient.get<BuyerLoyaltyHistory>("/buyer/loyalty/history", { params }),
};

export interface BuyerLoyaltyInfo {
  tier: "STANDARD" | "VIP";
  total_spent: string;
  loyalty_points: number;
  vip_threshold: string;
  points_multiplier: number;
  next_tier: "VIP" | null;
}

export interface LoyaltyHistoryItem {
  transaction_id: string;
  points_delta: number;
  reference_order_id: string | null;
  reason: string;
  created_at: string;
}

export interface BuyerLoyaltyHistory {
  items: LoyaltyHistoryItem[];
  page: number;
  limit: number;
  total: number;
}

