import type { RequestContext } from '../../../platform/context/request-context.ts';

export type SellerShopStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED';

export interface SellerShop {
  shop_id: string;
  shop_name: string;
  description: string | null;
  pickup_address: string | null;
  pickup_province?: string | null;
  pickup_province_code?: string | null;
  pickup_ward?: string | null;
  pickup_ward_code?: string | null;
  pickup_detail_address?: string | null;
  contact_phone: string | null;
  status: SellerShopStatus;
  updated_at: string;
}

export type SellerShopUpdate = Partial<Pick<SellerShop, 'shop_name' | 'description' | 'pickup_address' | 'pickup_province' | 'pickup_province_code' | 'pickup_ward' | 'pickup_ward_code' | 'pickup_detail_address' | 'contact_phone'>>;

export interface ISellerShopRepository {
  findOwned(context: RequestContext): Promise<SellerShop | null>;
  updateOwned(context: RequestContext, input: SellerShopUpdate): Promise<SellerShop | null>;
}
