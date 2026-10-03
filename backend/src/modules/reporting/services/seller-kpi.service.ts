import { NotFoundError } from '../../../platform/errors/app-error.ts';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import type { ISellerKpiRepository } from '../domain/seller-kpi.ts';
import { sellerShopId } from '../domain/seller-kpi.ts';

export class SellerKpiService {
  constructor(private readonly repository: ISellerKpiRepository) {}

  async get(context: RequestContext) {
    const result = await this.repository.getForShop(sellerShopId(context));
    if (!result) throw new NotFoundError('Seller shop not found');
    return result;
  }
}
