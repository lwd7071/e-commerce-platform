import { apiClient } from "./client";

/**
 * Voucher DTO matching runtime PgVoucherRepository (camelCase).
 */
export interface WireVoucher {
  voucherId: string;
  code: string;
  voucherName: string;
  scope: "PLATFORM" | "SHOP";
  shopId: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  maxDiscount: string | null;
  minOrderValue: string;
  quantity: number;
  startAt: string;
  endAt: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Discriminated union matching VoucherPortService runtime evaluate result.
 */
export type EvaluateVoucherResult =
  | { isValid: true; voucherId: string; discountAmount: string }
  | { isValid: false; errorCode: string; errorMessage: string };

export interface EvaluateVoucherPayload {
  code: string;
  order_subtotal: string;
  shop_id?: string;
  now?: string;
}

export const voucherApi = {
  getVouchers: (params?: { scope?: "PLATFORM" | "SHOP"; shop_id?: string; now?: string }) =>
    apiClient.get<WireVoucher[]>("/vouchers/applicable", { params }),

  evaluateVoucher: (data: EvaluateVoucherPayload) =>
    apiClient.post<EvaluateVoucherResult>("/vouchers/evaluate", data),
};
