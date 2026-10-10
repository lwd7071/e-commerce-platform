import { apiClient } from './client';

export interface SellerShopProfile {
  shop_id: string;
  shop_name: string;
  description: string | null;
  pickup_address: string | null;
  pickup_province?: string | null;
  pickup_province_code?: string | null;
  pickup_ward?: string | null;
  pickup_ward_code?: string | null;
  contact_phone: string | null;
  logo_url?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  tier?: 'STANDARD' | 'PREFERRED' | 'MALL';
  tier_override?: boolean;
  updated_at: string;
}

export type UpdateSellerShop = Partial<Pick<SellerShopProfile, 'shop_name' | 'description' | 'pickup_address' | 'pickup_province' | 'pickup_province_code' | 'pickup_ward' | 'pickup_ward_code' | 'contact_phone'>>;

export interface ShopMallRequest {
  request_id: string;
  id?: string;
  shop_id: string;
  seller_id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  document_url: string;
  reason: string;
  admin_note: string | null;
  admin_id: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMallRequestInput {
  document_url: string;
  reason: string;
}

export const sellerShopApi = {
  get: () => apiClient.get<SellerShopProfile>('/seller/shop'),
  update: (input: UpdateSellerShop) => apiClient.patch<SellerShopProfile>('/seller/shop', input),
  updateLogo: (mediaId: string) => apiClient.patch<SellerShopProfile>('/seller/shop/logo', { media_id: mediaId }),
  getMallRequests: () => apiClient.get<ShopMallRequest[]>('/seller/shop/mall-requests'),
  submitMallRequest: (input: CreateMallRequestInput) => apiClient.post<ShopMallRequest>('/seller/shop/mall-requests', input),
  cancelMallRequest: (id: string) => apiClient.post<ShopMallRequest>(`/seller/shop/mall-requests/${id}/cancel`),
};

