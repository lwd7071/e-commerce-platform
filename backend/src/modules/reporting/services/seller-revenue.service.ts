import { AppError, ForbiddenError } from '../../../platform/errors/app-error.ts';
import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ReportingDomainError } from '../domain/errors.ts';
import type { ReportDateFilter, ShopRevenueReport } from '../domain/types.ts';
import type { ReportingService } from './reporting.service.ts';

export class SellerRevenueService {
  constructor(private readonly reporting: ReportingService) {}

  async get(context: RequestContext, filter: ReportDateFilter = {}): Promise<ShopRevenueReport> {
    if (context.role !== 'SELLER' || !context.shop_id || context.shop_status !== 'ACTIVE') {
      throw new ForbiddenError('SHOP_NOT_ACTIVE', 'An active Seller shop is required');
    }
    try {
      return await this.reporting.getShopRevenueReport(context.shop_id, filter);
    } catch (error) {
      if (error instanceof ReportingDomainError) throw new AppError(422, error.code, error.message, error.details);
      throw error;
    }
  }
}
