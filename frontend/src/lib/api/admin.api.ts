import { apiClient } from "./client";
import type { AdminUserItem, AdminShopItem, LockUserPayload, LockShopPayload } from "../repositories/types";

export interface AdminUserParams extends Record<string, string | number | boolean | null | undefined> {
  role?: string;
  status?: string;
  search?: string;
}

export interface AdminShopParams extends Record<string, string | number | boolean | null | undefined> {
  status?: string;
  search?: string;
}

export const adminApi = {
  async getUsers(params?: AdminUserParams): Promise<AdminUserItem[]> {
    return apiClient.get<AdminUserItem[]>("/admin/users", { params });
  },

  async lockUser(payload: LockUserPayload): Promise<void> {
    await apiClient.post(`/admin/users/${payload.user_id}/lock`, { reason: payload.reason });
  },

  async unlockUser(userId: string): Promise<void> {
    await apiClient.post(`/admin/users/${userId}/unlock`, { reason: "Account unlocked by admin" });
  },

  async getShops(params?: AdminShopParams): Promise<AdminShopItem[]> {
    return apiClient.get<AdminShopItem[]>("/admin/shops", { params });
  },

  async approveShop(shopId: string, reason?: string): Promise<void> {
    await apiClient.post(`/admin/shops/${shopId}/approve`, { reason: reason || "Shop approved by admin" });
  },

  async lockShop(payload: LockShopPayload): Promise<void> {
    await apiClient.post(`/admin/shops/${payload.shop_id}/lock`, { reason: payload.reason });
  },

  async unlockShop(shopId: string, reason?: string): Promise<void> {
    await apiClient.post(`/admin/shops/${shopId}/unlock`, { reason: reason || "Shop unlocked by admin" });
  },
};
