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
  tier?: string;
}

export const adminApi = {
  async getUsers(params?: AdminUserParams): Promise<AdminUserItem[]> {
    return apiClient.get<AdminUserItem[]>("/admin/users", { params });
  },

  async getUserDetail(userId: string): Promise<AdminUserItem> {
    return apiClient.get<AdminUserItem>(`/admin/users/${userId}`);
  },

  async getUsersPage(params?: AdminUserParams & { page?: number; page_size?: number; limit?: number }): Promise<{ items: AdminUserItem[]; next_cursor: string | null; has_more: boolean; page: number; page_size: number; total_items: number; total_pages: number }> {
    const envelope = await apiClient.getPaginated<AdminUserItem>("/admin/users", { params });
    return {
      items: envelope.data || [],
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
      page: envelope.meta?.page ?? 1,
      page_size: envelope.meta?.page_size ?? envelope.meta?.limit ?? 20,
      total_items: envelope.meta?.total_items ?? envelope.data.length,
      total_pages: envelope.meta?.total_pages ?? 1,
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

  async getShopsPage(params?: AdminShopParams & { page?: number; page_size?: number; limit?: number }): Promise<{ items: AdminShopItem[]; next_cursor: string | null; has_more: boolean; page: number; page_size: number; total_items: number; total_pages: number }> {
    const envelope = await apiClient.getPaginated<AdminShopItem>("/admin/shops", { params });
    return {
      items: envelope.data || [],
      next_cursor: envelope.meta?.next_cursor ?? null,
      has_more: envelope.meta?.has_more ?? false,
      page: envelope.meta?.page ?? 1,
      page_size: envelope.meta?.page_size ?? envelope.meta?.limit ?? 20,
      total_items: envelope.meta?.total_items ?? envelope.data.length,
      total_pages: envelope.meta?.total_pages ?? 1,
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

  async updateShopTier(shopId: string, tier: "STANDARD" | "PREFERRED" | "MALL", reason: string): Promise<void> {
    await apiClient.patch(`/admin/shops/${shopId}/tier`, { tier, reason });
  },

  async getMallRequests(params?: { status?: string; limit?: number; cursor?: string }): Promise<import('./seller-shop.api').ShopMallRequest[]> {
    return apiClient.get<import('./seller-shop.api').ShopMallRequest[]>("/admin/shops/mall-requests", { params });
  },

  async getMallRequestsPage(params: { status?: string; page: number; page_size: number }): Promise<{ items: import('./seller-shop.api').ShopMallRequest[]; page: number; page_size: number; total_items: number; total_pages: number }> {
    const result = await apiClient.getPaginated<import('./seller-shop.api').ShopMallRequest>("/admin/shops/mall-requests", { params });
    return { items: result.data, page: result.meta.page ?? params.page, page_size: result.meta.page_size ?? params.page_size, total_items: result.meta.total_items ?? result.data.length, total_pages: result.meta.total_pages ?? 1 };
  },

  async approveMallRequest(requestId: string, note: string): Promise<import('./seller-shop.api').ShopMallRequest> {
    return apiClient.post<import('./seller-shop.api').ShopMallRequest>(`/admin/shops/mall-requests/${requestId}/approve`, { note });
  },

  async rejectMallRequest(requestId: string, reason: string): Promise<import('./seller-shop.api').ShopMallRequest> {
    return apiClient.post<import('./seller-shop.api').ShopMallRequest>(`/admin/shops/mall-requests/${requestId}/reject`, { reason });
  },
};
