import { apiClient } from "./client";

export interface WireProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: "BUYER" | "SELLER" | "ADMIN";
}

export interface WireAddress {
  id: string;
  receiver_name: string;
  phone_number: string;
  address_line: string;
  ward: string;
  district: string;
  city: string;
  is_default: boolean;
}

export interface WireCartItem {
  id: string;
  variant_id: string;
  quantity: number;
  is_selected: boolean;
}

export interface WireCart {
  id: string;
  items: WireCartItem[];
}

export const buyerApi = {
  getProfile: () => apiClient.get<WireProfile>("/buyers/profile"),
  updateProfile: (data: Partial<Pick<WireProfile, "full_name" | "phone" | "avatar_url">>) =>
    apiClient.patch<WireProfile>("/buyers/profile", data),

  getAddresses: () => apiClient.get<WireAddress[]>("/buyers/addresses"),
  createAddress: (data: Omit<WireAddress, "id">) => apiClient.post<WireAddress>("/buyers/addresses", data),

  getCart: () => apiClient.get<WireCart>("/cart"),
  addToCart: (data: { variant_id: string; quantity: number }) =>
    apiClient.post<WireCartItem>("/cart/items", data),

  getNotifications: () => apiClient.get<unknown[]>("/notifications"),
  markNotificationRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
};
