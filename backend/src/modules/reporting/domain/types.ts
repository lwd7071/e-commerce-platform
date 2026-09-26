export type UUID = string;
export type DecimalString = string;

export interface ReportDateFilter {
  readonly from?: string;
  readonly to?: string;
}

export interface ShopRevenueReport {
  readonly shopId: UUID;
  readonly totalOrders: number;
  readonly completedOrders: number;
  readonly cancelledOrders: number;
  readonly otherOrders: number;
  readonly grossRevenue: DecimalString; // Sum of totalAmount of COMPLETED orders (QD19)
  readonly netSubtotal: DecimalString;  // Sum of subtotal of COMPLETED orders (QD19)
  readonly totalDiscount: DecimalString;// Sum of discountAmount of COMPLETED orders (QD19)
  readonly totalShipping: DecimalString;// Sum of shippingFee of COMPLETED orders (QD19)
  readonly averageOrderValue: DecimalString; // grossRevenue / completedOrders
  readonly generatedAt: string;
}

export interface BuyerSpendingReport {
  readonly buyerId: UUID;
  readonly totalOrders: number;
  readonly completedOrders: number;
  readonly cancelledOrders: number;
  readonly totalSpent: DecimalString;   // Sum of totalAmount of COMPLETED orders (QD19)
  readonly totalSaved: DecimalString;   // Sum of discountAmount of COMPLETED orders (QD19)
  readonly averageOrderValue: DecimalString;
  readonly generatedAt: string;
}

export interface PlatformSummaryReport {
  readonly totalOrders: number;
  readonly completedOrders: number;
  readonly cancelledOrders: number;
  readonly deliveryFailedOrders: number;
  readonly inProgressOrders: number;
  readonly grossPlatformRevenue: DecimalString; // Sum of COMPLETED orders (QD19)
  readonly totalPlatformDiscount: DecimalString;// Sum of COMPLETED orders (QD19)
  readonly averageOrderValue: DecimalString;
  readonly generatedAt: string;
}
