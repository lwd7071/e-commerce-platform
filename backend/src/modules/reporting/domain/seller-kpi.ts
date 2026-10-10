import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ForbiddenError } from '../../../platform/errors/app-error.ts';

export interface SellerKpi {
  shopId: string;
  shopName: string;
  totalRevenue: string;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  activeProductsCount: number;
  averageRating: number;
}

export interface ISellerKpiRepository {
  getForShop(shopId: string): Promise<SellerKpi | null>;
}

export function sellerShopId(context: RequestContext): string {
  if (context.role !== 'SELLER' || !context.shop_id || context.shop_status !== 'ACTIVE') {
    throw new ForbiddenError('SHOP_NOT_ACTIVE', 'Seller shop must be active before reading seller analytics');
  }
  return context.shop_id;
}
