import { apiClient } from './client';

export interface SellerVoucher {
  voucher_id: string;
  code: string;
  voucher_name: string;
  scope: 'SHOP';
  shop_id: string;
  discount_type: 'PERCENT' | 'FIXED';
  discount_value: string;
  max_discount: string | null;
  min_order_value: string;
  quantity: number;
  start_at: string;
  end_at: string;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
}

export type SellerVoucherInput = Omit<SellerVoucher, 'voucher_id' | 'scope' | 'shop_id' | 'status' | 'created_at' | 'updated_at'>;

export const sellerVoucherApi = {
  list: () => apiClient.get<SellerVoucher[]>('/seller/vouchers'),
  get: (voucherId: string) => apiClient.get<SellerVoucher>(`/seller/vouchers/${voucherId}`),
  create: (input: SellerVoucherInput) => apiClient.post<SellerVoucher>('/seller/vouchers', input),
  update: (voucherId: string, input: Partial<SellerVoucherInput>) => apiClient.patch<SellerVoucher>(`/seller/vouchers/${voucherId}`, input),
  setStatus: (voucherId: string, status: SellerVoucher['status']) => apiClient.patch<SellerVoucher>(`/seller/vouchers/${voucherId}/status`, { status }),
};
