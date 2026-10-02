import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { IOrderRepository, OrderRecord } from '../../../src/modules/order/domain/repositories.ts';
import { OrderLifecycleService } from '../../../src/modules/order/services/order-lifecycle.service.ts';

describe('Admin Order intervention reason (RB-LTT08)', () => {
  it('requires an explicit reason when Admin confirms delivery and stores that reason in history', async () => {
    const order: OrderRecord = {
      orderId: '00000000-0000-4000-8000-000000000001', buyerId: '00000000-0000-4000-8000-000000000002', shopId: '00000000-0000-4000-8000-000000000003',
      status: 'SHIPPING', subtotal: '100.00', discountAmount: '0.00', shippingFee: '0.00', totalAmount: '100.00',
      recipientName: 'Buyer', recipientPhone: '0900000000', province: 'HCMC', district: 'D1', ward: 'Ward 1', deliveryAddress: 'Test address',
      createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    };
    const histories: Array<{ reason?: string | null }> = [];
    const repository = {
      findById: async () => order,
      updateStatus: async (_id: string, _status: string, history: { reason?: string | null }) => { histories.push(history); },
    } as unknown as IOrderRepository;
    const service = new OrderLifecycleService({ orderRepo: repository });
    const admin = { kind: 'ADMIN' as const, userId: '00000000-0000-4000-8000-000000000004' };

    await assert.rejects(service.confirmReceived(order.orderId, admin), { code: 'REASON_REQUIRED' });
    await service.confirmReceived(order.orderId, admin, 'Delivery evidence verified');
    assert.equal(histories.at(-1)?.reason, 'Delivery evidence verified');
  });
});
