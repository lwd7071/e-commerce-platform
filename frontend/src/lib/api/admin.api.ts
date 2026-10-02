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

  async getUserDetail(userId: string): Promise<AdminUserItem> {
    return apiClient.get<AdminUserItem>(`/admin/users/${userId}`);
  },

  async getUsersPage(params?: AdminUserParams): Promise<{ items: AdminUserItem[]; next_cursor: string | null; has_more: boolean }> {
    const envelope = await apiClient.getPaginated<AdminUserItem>("/admin/users", { params });
    return {
      items: envelope.data || [],
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
    };
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

  async getShopDetail(shopId: string): Promise<AdminShopItem> {
    return apiClient.get<AdminShopItem>(`/admin/shops/${shopId}`);
  },

  async getShopsPage(params?: AdminShopParams): Promise<{ items: AdminShopItem[]; next_cursor: string | null; has_more: boolean }> {
    const envelope = await apiClient.getPaginated<AdminShopItem>("/admin/shops", { params });
    return {
      items: envelope.data || [],
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
    };
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
