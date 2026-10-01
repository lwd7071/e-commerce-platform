import { apiClient } from './client';

export interface SellerShopProfile {
  shop_id: string;
  shop_name: string;
  description: string | null;
  pickup_address: string | null;
  contact_phone: string | null;
  logo_url?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';
  updated_at: string;
}

export type UpdateSellerShop = Partial<Pick<SellerShopProfile, 'shop_name' | 'description' | 'pickup_address' | 'contact_phone'>>;

export const sellerShopApi = {
  get: () => apiClient.get<SellerShopProfile>('/seller/shop'),
  update: (input: UpdateSellerShop) => apiClient.patch<SellerShopProfile>('/seller/shop', input),
  updateLogo: (mediaId: string) => apiClient.patch<SellerShopProfile>('/seller/shop/logo', { media_id: mediaId }),
};

