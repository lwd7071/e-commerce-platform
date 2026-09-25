import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReportingService } from '../../../src/modules/reporting/services/reporting.service.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { ReportingDomainError } from '../../../src/modules/reporting/domain/errors.ts';
import type { OrderRecord } from '../../../src/modules/order/domain/repositories.ts';

function createOrder(overrides: Partial<OrderRecord>): OrderRecord {
  return {
    orderId: 'order-' + Math.random().toString(36).slice(2, 8),
    buyerId: 'buyer-rep-1',
    shopId: 'shop-rep-1',
    recipientName: 'Tester',
    recipientPhone: '0901234567',
    province: 'HCM',
    district: 'Q1',
    ward: 'BN',
    deliveryAddress: '123 Test St',
    subtotal: '100000.00',
    discountAmount: '10000.00',
    shippingFee: '15000.00',
    totalAmount: '105000.00',
    status: 'COMPLETED',
    createdAt: '2026-09-25T10:00:00.000Z',
    updatedAt: '2026-09-25T10:00:00.000Z',
    ...overrides,
  };
}

test('[QD19] Shop revenue report strictly includes ONLY COMPLETED orders', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const reportingService = new ReportingService({ orderRepo });
  const shopId = 'shop-analytics-1';

  // 1. COMPLETED order: 100,000 subtotal, 10,000 discount, 20,000 shipping -> total 110,000
  const order1 = createOrder({
    shopId,
    status: 'COMPLETED',
    subtotal: '100000.00',
    discountAmount: '10000.00',
    shippingFee: '20000.00',
    totalAmount: '110000.00',
  });

  // 2. COMPLETED order: 200,000 subtotal, 0 discount, 30,000 shipping -> total 230,000
  const order2 = createOrder({
    shopId,
    status: 'COMPLETED',
    subtotal: '200000.00',
    discountAmount: '0.00',
    shippingFee: '30000.00',
    totalAmount: '230000.00',
  });

  // 3. CANCELLED order: 500,000 total (MUST NOT be counted in revenue)
  const order3 = createOrder({
    shopId,
    status: 'CANCELLED',
    subtotal: '500000.00',
    discountAmount: '0.00',
    shippingFee: '50000.00',
    totalAmount: '550000.00',
  });

  // 4. PENDING order: 300,000 total (MUST NOT be counted in revenue)
  const order4 = createOrder({
    shopId,
    status: 'PENDING_CONFIRMATION',
    subtotal: '300000.00',
    discountAmount: '0.00',
    shippingFee: '20000.00',
    totalAmount: '320000.00',
  });

  // 5. SHIPPING order: 150,000 total (MUST NOT be counted in revenue)
  const order5 = createOrder({
    shopId,
    status: 'SHIPPING',
    subtotal: '150000.00',
    discountAmount: '0.00',
    shippingFee: '15000.00',
    totalAmount: '165000.00',
  });

  const dummyHistory = {
    historyId: 'h1',
    orderId: 'dummy',
    oldStatus: null,
    newStatus: 'COMPLETED' as const,
    changedBy: null,
    reason: null,
    changedAt: new Date().toISOString(),
  };

  for (const o of [order1, order2, order3, order4, order5]) {
    await orderRepo.createOrder(o, [], { ...dummyHistory, orderId: o.orderId, newStatus: o.status });
  }

  const report = await reportingService.getShopRevenueReport(shopId);

  assert.equal(report.shopId, shopId);
  assert.equal(report.totalOrders, 5);
  assert.equal(report.completedOrders, 2);
  assert.equal(report.cancelledOrders, 1);
  assert.equal(report.otherOrders, 2);

  // Revenue = 110,000 + 230,000 = 340,000.00
  assert.equal(report.grossRevenue, '340000.00');
  assert.equal(report.netSubtotal, '300000.00');
  assert.equal(report.totalDiscount, '10000.00');
  assert.equal(report.totalShipping, '50000.00');
  // AOV = 340,000 / 2 = 170,000.00
  assert.equal(report.averageOrderValue, '170000.00');
});

test('[QD19] Invalid report date filters throw REPORT_FILTER_INVALID', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const reportingService = new ReportingService({ orderRepo });

  // Invalid date format
  await assert.rejects(
    async () => {
      await reportingService.getShopRevenueReport('shop-1', { from: 'invalid-date' });
    },
    (err: any) => {
      assert(err instanceof ReportingDomainError);
      assert.equal(err.code, 'REPORT_FILTER_INVALID');
      return true;
    },
  );

  // from date is after to date
  await assert.rejects(
    async () => {
      await reportingService.getShopRevenueReport('shop-1', {
        from: '2026-10-01T00:00:00Z',
        to: '2026-09-01T00:00:00Z',
      });
    },
    (err: any) => {
      assert(err instanceof ReportingDomainError);
      assert.equal(err.code, 'REPORT_FILTER_INVALID');
      return true;
    },
  );
});

test('[QD19] Date range filter correctly bounds aggregated revenue and counts', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const reportingService = new ReportingService({ orderRepo });
  const shopId = 'shop-date-filter';

  const o1 = createOrder({
    shopId,
    status: 'COMPLETED',
    totalAmount: '100000.00',
    createdAt: '2026-09-01T10:00:00Z',
  });
  const o2 = createOrder({
    shopId,
    status: 'COMPLETED',
    totalAmount: '200000.00',
    createdAt: '2026-09-15T10:00:00Z',
  });
  const o3 = createOrder({
    shopId,
    status: 'COMPLETED',
    totalAmount: '300000.00',
    createdAt: '2026-09-30T10:00:00Z',
  });

  const dummyHistory = {
    historyId: 'h1',
    orderId: 'dummy',
    oldStatus: null,
    newStatus: 'COMPLETED' as const,
    changedBy: null,
    reason: null,
    changedAt: new Date().toISOString(),
  };

  for (const o of [o1, o2, o3]) {
    await orderRepo.createOrder(o, [], { ...dummyHistory, orderId: o.orderId });
  }

  // Filter only between 2026-09-10 and 2026-09-20 -> only o2 matches
  const report = await reportingService.getShopRevenueReport(shopId, {
    from: '2026-09-10T00:00:00Z',
    to: '2026-09-20T00:00:00Z',
  });

  assert.equal(report.totalOrders, 1);
  assert.equal(report.completedOrders, 1);
  assert.equal(report.grossRevenue, '200000.00');
});

test('[QD19] Buyer spending report calculates completed orders expenditure and discounts', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const reportingService = new ReportingService({ orderRepo });
  const buyerId = 'buyer-spent-1';

  const order1 = createOrder({
    buyerId,
    status: 'COMPLETED',
    subtotal: '200000.00',
    discountAmount: '30000.00',
    totalAmount: '190000.00', // 200k - 30k + 20k shipping
  });
  const order2 = createOrder({
    buyerId,
    status: 'CANCELLED',
    subtotal: '400000.00',
    discountAmount: '50000.00',
    totalAmount: '350000.00',
  });

  const dummyHistory = {
    historyId: 'h1',
    orderId: 'dummy',
    oldStatus: null,
    newStatus: 'COMPLETED' as const,
    changedBy: null,
    reason: null,
    changedAt: new Date().toISOString(),
  };

  await orderRepo.createOrder(order1, [], { ...dummyHistory, orderId: order1.orderId, newStatus: order1.status });
  await orderRepo.createOrder(order2, [], { ...dummyHistory, orderId: order2.orderId, newStatus: order2.status });

  const report = await reportingService.getBuyerSpendingReport(buyerId);

  assert.equal(report.buyerId, buyerId);
  assert.equal(report.totalOrders, 2);
  assert.equal(report.completedOrders, 1);
  assert.equal(report.cancelledOrders, 1);
  assert.equal(report.totalSpent, '190000.00');
  assert.equal(report.totalSaved, '30000.00');
  assert.equal(report.averageOrderValue, '190000.00');
});

test('[QD19] Platform summary report aggregates overall platform volume and realized revenue', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const reportingService = new ReportingService({ orderRepo });

  const orders = [
    createOrder({ status: 'COMPLETED', totalAmount: '500000.00', discountAmount: '50000.00' }),
    createOrder({ status: 'COMPLETED', totalAmount: '700000.00', discountAmount: '70000.00' }),
    createOrder({ status: 'CANCELLED', totalAmount: '400000.00' }),
    createOrder({ status: 'DELIVERY_FAILED', totalAmount: '300000.00' }),
    createOrder({ status: 'PREPARING', totalAmount: '200000.00' }),
  ];

  const report = await reportingService.getPlatformSummaryReport(orders);

  assert.equal(report.totalOrders, 5);
  assert.equal(report.completedOrders, 2);
  assert.equal(report.cancelledOrders, 1);
  assert.equal(report.deliveryFailedOrders, 1);
  assert.equal(report.inProgressOrders, 1);
  assert.equal(report.grossPlatformRevenue, '1200000.00'); // 500k + 700k
  assert.equal(report.totalPlatformDiscount, '120000.00');
  assert.equal(report.averageOrderValue, '600000.00');
});
