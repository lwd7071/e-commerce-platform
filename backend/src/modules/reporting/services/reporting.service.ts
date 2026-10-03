import type { IOrderRepository, OrderRecord } from '../../order/domain/repositories.ts';
import type {
  ReportDateFilter,
  ShopRevenueReport,
  BuyerSpendingReport,
  PlatformSummaryReport,
} from '../domain/types.ts';
import { ReportingDomainError } from '../domain/errors.ts';

function parseCents(amount: string): bigint {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
}

function formatCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  const whole = (abs / 100n).toString();
  const fraction = (abs % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export class ReportingService {
  private orderRepo: IOrderRepository;

  constructor(deps: { orderRepo: IOrderRepository }) {
    this.orderRepo = deps.orderRepo;
  }

  private validateDateFilter(filter?: ReportDateFilter): void {
    if (!filter) return;
    if (filter.from !== undefined) {
      if (!filter.from || isNaN(Date.parse(filter.from))) {
        throw new ReportingDomainError('REPORT_FILTER_INVALID', 'Invalid "from" date filter.');
      }
    }
    if (filter.to !== undefined) {
      if (!filter.to || isNaN(Date.parse(filter.to))) {
        throw new ReportingDomainError('REPORT_FILTER_INVALID', 'Invalid "to" date filter.');
      }
    }
    if (filter.from !== undefined && filter.to !== undefined) {
      if (Date.parse(filter.from) > Date.parse(filter.to)) {
        throw new ReportingDomainError('REPORT_FILTER_INVALID', '"from" date cannot be after "to" date.');
      }
    }
  }

  private filterByDate(orders: OrderRecord[], filter?: ReportDateFilter): OrderRecord[] {
    if (!filter) return orders;
    return orders.filter(order => {
      const time = Date.parse(order.createdAt);
      if (filter.from !== undefined && time < Date.parse(filter.from)) return false;
      if (filter.to !== undefined && time > Date.parse(filter.to)) return false;
      return true;
    });
  }

  /**
   * Generates a revenue report for a specific shop.
   * Enforces QD19: Revenue calculation only factors in COMPLETED orders.
   */
  public async getShopRevenueReport(
    shopId: string,
    filter?: ReportDateFilter,
  ): Promise<ShopRevenueReport> {
    this.validateDateFilter(filter);

    const allShopOrders = await this.orderRepo.findByShopId(shopId);
    const orders = this.filterByDate(allShopOrders, filter);

    let completedOrders = 0;
    let cancelledOrders = 0;
    let otherOrders = 0;

    let grossRevenueCents = 0n;
    let netSubtotalCents = 0n;
    let totalDiscountCents = 0n;
    let totalShippingCents = 0n;

    for (const order of orders) {
      if (order.status === 'COMPLETED') {
        completedOrders++;
        grossRevenueCents += parseCents(order.totalAmount);
        netSubtotalCents += parseCents(order.subtotal);
        totalDiscountCents += parseCents(order.discountAmount);
        totalShippingCents += parseCents(order.shippingFee);
      } else if (order.status === 'CANCELLED') {
        cancelledOrders++;
      } else {
        otherOrders++;
      }
    }

    const aovCents = completedOrders > 0 ? grossRevenueCents / BigInt(completedOrders) : 0n;

    return {
      shopId,
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      otherOrders,
      grossRevenue: formatCents(grossRevenueCents),
      netSubtotal: formatCents(netSubtotalCents),
      totalDiscount: formatCents(totalDiscountCents),
      totalShipping: formatCents(totalShippingCents),
      averageOrderValue: formatCents(aovCents),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates a spending report for a specific buyer.
   * Enforces QD19: Only COMPLETED orders represent realized expenditure.
   */
  public async getBuyerSpendingReport(
    buyerId: string,
    filter?: ReportDateFilter,
  ): Promise<BuyerSpendingReport> {
    this.validateDateFilter(filter);

    const allBuyerOrders = await this.orderRepo.findByBuyerId(buyerId);
    const orders = this.filterByDate(allBuyerOrders, filter);

    let completedOrders = 0;
    let cancelledOrders = 0;

    let totalSpentCents = 0n;
    let totalSavedCents = 0n;

    for (const order of orders) {
      if (order.status === 'COMPLETED') {
        completedOrders++;
        totalSpentCents += parseCents(order.totalAmount);
        totalSavedCents += parseCents(order.discountAmount);
      } else if (order.status === 'CANCELLED') {
        cancelledOrders++;
      }
    }

    const aovCents = completedOrders > 0 ? totalSpentCents / BigInt(completedOrders) : 0n;

    return {
      buyerId,
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      totalSpent: formatCents(totalSpentCents),
      totalSaved: formatCents(totalSavedCents),
      averageOrderValue: formatCents(aovCents),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates platform-wide overview statistics.
   * Enforces QD19: Gross platform revenue only includes COMPLETED orders.
   */
  public async getPlatformSummaryReport(
    allOrders: OrderRecord[],
    filter?: ReportDateFilter,
  ): Promise<PlatformSummaryReport> {
    this.validateDateFilter(filter);

    const orders = this.filterByDate(allOrders, filter);

    let completedOrders = 0;
    let cancelledOrders = 0;
    let deliveryFailedOrders = 0;
    let inProgressOrders = 0;

    let grossPlatformRevenueCents = 0n;
    let totalPlatformDiscountCents = 0n;

    for (const order of orders) {
      if (order.status === 'COMPLETED') {
        completedOrders++;
        grossPlatformRevenueCents += parseCents(order.totalAmount);
        totalPlatformDiscountCents += parseCents(order.discountAmount);
      } else if (order.status === 'CANCELLED') {
        cancelledOrders++;
      } else if (order.status === 'DELIVERY_FAILED') {
        deliveryFailedOrders++;
      } else {
        inProgressOrders++;
      }
    }

    const aovCents = completedOrders > 0 ? grossPlatformRevenueCents / BigInt(completedOrders) : 0n;

    return {
      totalOrders: orders.length,
      completedOrders,
      cancelledOrders,
      deliveryFailedOrders,
      inProgressOrders,
      grossPlatformRevenue: formatCents(grossPlatformRevenueCents),
      totalPlatformDiscount: formatCents(totalPlatformDiscountCents),
      averageOrderValue: formatCents(aovCents),
      generatedAt: new Date().toISOString(),
    };
  }
}
