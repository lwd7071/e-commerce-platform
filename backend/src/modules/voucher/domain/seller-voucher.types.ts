import type { RequestContext } from '../../../platform/context/request-context.ts';

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

export type SellerVoucherFields = Pick<SellerVoucher, 'code' | 'voucher_name' | 'discount_type' | 'discount_value' | 'max_discount' | 'min_order_value' | 'quantity' | 'start_at' | 'end_at'>;
export type SellerVoucherPatch = Partial<SellerVoucherFields>;

export interface ISellerVoucherRepository {
  list(shopId: string): Promise<SellerVoucher[]>;
  find(shopId: string, voucherId: string): Promise<SellerVoucher | null>;
  create(context: RequestContext, fields: SellerVoucherFields): Promise<SellerVoucher>;
  updateIfUnused(context: RequestContext, voucherId: string, fields: SellerVoucherFields): Promise<SellerVoucher | null>;
  setStatus(context: RequestContext, voucherId: string, status: SellerVoucher['status']): Promise<SellerVoucher | null>;
  hasUsage(shopId: string, voucherId: string): Promise<boolean>;
}
