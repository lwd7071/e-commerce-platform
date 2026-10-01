import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryOrderRepository } from '../../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { OrderLifecycleService } from '../../../../src/modules/order/services/order-lifecycle.service.ts';
import { OrderDomainError } from '../../../../src/modules/order/domain/errors.ts';
import type { OrderRecord } from '../../../../src/modules/order/domain/repositories.ts';

describe('/diagnose Person 4 - Seller Order Transitions', () => {
  const buyerId = '11111111-1111-4111-8111-111111111111';
  const sellerUserId = '22222222-2222-4222-8222-222222222222';
  const shopId = '33333333-3333-4333-8333-333333333333';
  const otherShopId = '99999999-9999-4999-8999-999999999999';
  const orderId = '44444444-4444-4444-8444-444444444444';

  it('Issue 1: Seller chuyển đơn từ PREPARING sang SHIPPING sau khi xác nhận bàn giao', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });

    const order: OrderRecord = {
      orderId,
      buyerId,
      shopId,
      subtotal: '100000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '120000.00',
      status: 'PREPARING',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await orderRepo.createOrder(order, [], {
      historyId: 'h-1',
      orderId,
      oldStatus: 'CONFIRMED',
      newStatus: 'PREPARING',
      changedBy: sellerUserId,
      reason: null,
      changedAt: new Date().toISOString(),
    });

    const sellerActor = { kind: 'SELLER' as const, userId: sellerUserId, shopId };

    // Seller reports verified handover before moving to SHIPPING.
    const result = await lifecycle.transitionOrder(orderId, sellerActor, {
      to: 'SHIPPING',
      shipmentStatus: 'HANDED_OVER',
    });

    assert.ok(result);
    assert.strictEqual(result.status, 'SHIPPING');
  });

  it('Test 2: Chặn Seller chuyển đơn sang COMPLETED (QD11)', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });

    const order: OrderRecord = {
      orderId,
      buyerId,
      shopId,
      subtotal: '100000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '120000.00',
      status: 'SHIPPING',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await orderRepo.createOrder(order, [], {
      historyId: 'h-2',
      orderId,
      oldStatus: 'PREPARING',
      newStatus: 'SHIPPING',
      changedBy: sellerUserId,
      reason: null,
      changedAt: new Date().toISOString(),
    });

    const sellerActor = { kind: 'SELLER' as const, userId: sellerUserId, shopId };

    await assert.rejects(
      async () => lifecycle.transitionOrder(orderId, sellerActor, { to: 'COMPLETED' }),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'RESOURCE_FORBIDDEN'
    );
  });

  it('Test 3: Chặn Seller của Shop khác can thiệp đơn hàng (Cross-shop isolation)', async () => {
    const orderRepo = new InMemoryOrderRepository();
    const lifecycle = new OrderLifecycleService({ orderRepo });

    const order: OrderRecord = {
      orderId,
      buyerId,
      shopId,
      subtotal: '100000.00',
      discountAmount: '0.00',
      shippingFee: '20000.00',
      totalAmount: '120000.00',
      status: 'PENDING_CONFIRMATION',
      recipientName: 'Nguyen Van A',
      recipientPhone: '0901234567',
      province: 'Ha Noi',
      district: 'Ba Dinh',
      ward: 'Kim Ma',
      deliveryAddress: '123 Kim Ma',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await orderRepo.createOrder(order, [], {
      historyId: 'h-3',
      orderId,
      oldStatus: null,
      newStatus: 'PENDING_CONFIRMATION',
      changedBy: buyerId,
      reason: null,
      changedAt: new Date().toISOString(),
    });

    const otherSellerActor = { kind: 'SELLER' as const, userId: 'other-user', shopId: otherShopId };

    // Seller Shop khác cố confirm đơn
    await assert.rejects(
      async () => lifecycle.confirmOrder(orderId, otherSellerActor),
      (err: unknown) => err instanceof OrderDomainError && err.code === 'RESOURCE_FORBIDDEN'
    );
  });
});
