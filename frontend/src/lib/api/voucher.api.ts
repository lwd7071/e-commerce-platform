import { apiClient } from "./client";

export interface WireVoucher {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  discount_value: string;
  min_order_value: string;
  max_discount: string | null;
  start_at: string;
  end_at: string;
}

export interface EvaluateVoucherResult {
  is_valid: boolean;
  discount_amount: string;
  reason?: string;
}

export const voucherApi = {
  getVouchers: () => apiClient.get<WireVoucher[]>("/vouchers"),

  evaluateVoucher: (data: { code: string; order_subtotal: string; shop_id?: string }) =>
    apiClient.post<EvaluateVoucherResult>("/vouchers/evaluate", data),
};
