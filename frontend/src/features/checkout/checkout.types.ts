/**
 * Checkout domain types for Dino E-Commerce (Người 4 - B-404, B-406, B-407).
 */

export interface CheckoutAddress {
  addressId: string;
  recipientName: string;
  phone: string;
  province: string;
  provinceCode?: string | null;
  district?: string | null;
  ward: string;
  wardCode?: string | null;
  detailAddress: string;
  isDefault: boolean;
}

export interface CreateAddressInput {
  recipientName?: string;
  recipient_name?: string;
  phone: string;
  province: string;
  district?: string;
  ward: string;
  province_code?: string;
  ward_code?: string;
  detailAddress?: string;
  detail_address?: string;
  isDefault?: boolean;
  is_default?: boolean;
}

export interface CheckoutVoucher {
  voucherId: string;
  code: string;
  voucherName: string;
  scope: "PLATFORM" | "SHOP";
  shopId: string | null;
  discountType: "PERCENT" | "FIXED";
  discountValue: string;
  maxDiscount: string | null;
  minOrderValue: string;
}

export type VoucherEvaluationResult =
  | { isValid: true; voucherId: string; discountAmount: string }
  | { isValid: false; errorCode: string; errorMessage: string };

export type PaymentMethod = "COD" | "ONLINE";

export interface CheckoutPayload {
  address_id: string;
  payment_method: PaymentMethod;
  vouchers: Array<{ shop_id: string; code: string }>;
  expected_shipping_fees?: Array<{ shop_id: string; fee: string }>;
}

export interface CheckoutShippingQuote { shop_id: string; fee: string; weight_grams: number; provider: 'mock' | 'ghtk' }

export interface CheckoutOrderResult {
  order_id: string;
  shop_id: string;
  status: string;
  total_amount: string;
  payment_id: string;
}

export interface CheckoutResult {
  orders: CheckoutOrderResult[];
}
