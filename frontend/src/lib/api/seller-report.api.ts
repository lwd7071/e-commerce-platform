import { apiClient } from './client';

export interface SellerRevenueReport {
  shopId: string;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  otherOrders: number;
  grossRevenue: string;
  netSubtotal: string;
  totalDiscount: string;
  totalShipping: string;
  averageOrderValue: string;
  generatedAt: string;
}

export const sellerReportApi = {
  getRevenue: (filter?: { from?: string; to?: string }) => apiClient.get<SellerRevenueReport>('/seller/reports/revenue', { params: filter }),
};
