import { apiClient } from "./client";

export interface WireProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "BUYER" | "SELLER" | "ADMIN";
}

/**
 * Address DTO matching runtime PgAddressRepository (camelCase).
 */
export interface WireAddress {
  addressId: string;
  userId?: string;
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

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
  // GAP-07: Profile API is NOT mounted on backend runtime (HTTP 404 MISSING).
  // Profile is read-only from Supabase Auth metadata in AuthProvider.
  // Fail-fast explicitly with GAP-07 error rather than making a dead HTTP call:
  getProfile: (): Promise<WireProfile> =>
    Promise.reject(new Error("GAP-07: /buyers/profile chưa mount trên backend runtime (HTTP 404 MISSING)")),
  updateProfile: (_data?: Partial<Pick<WireProfile, "full_name" | "phone" | "avatar_url">>): Promise<WireProfile> => {
    void _data;
    return Promise.reject(new Error("GAP-07: /buyers/profile chưa mount trên backend runtime (HTTP 404 MISSING)"));
  },

  // Address operations (AVAILABLE in runtime at /addresses)
  getAddresses: () => apiClient.get<WireAddress[]>("/addresses"),
  createAddress: (data: CreateAddressPayload) => apiClient.post<WireAddress>("/addresses", data),

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
  getNotifications: () => apiClient.get<unknown[]>("/notifications"),
  markNotificationRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
};
