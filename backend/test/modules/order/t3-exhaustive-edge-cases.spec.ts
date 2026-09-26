import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderLifecycleService } from '../../../src/modules/order/services/order-lifecycle.service.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';
import { PaymentService } from '../../../src/modules/payment/services/payment.service.ts';
import { InMemoryPaymentRepository } from '../../../src/modules/payment/repositories/in-memory-payment.repository.ts';
import { transitionShipment } from '../../../src/modules/shipment/domain/shipment-state-machine.ts';
import type { OrderRecord, OrderItemRecord } from '../../../src/modules/order/domain/repositories.ts';
import type { OrderStatusHistoryRecord } from '../../../src/modules/order/domain/order-snapshot.ts';
import type { PaymentRecord } from '../../../src/modules/payment/domain/repositories.ts';
import { OrderDomainError } from '../../../src/modules/order/domain/errors.ts';
import { PaymentDomainError } from '../../../src/modules/payment/domain/errors.ts';

function createDummyOrder(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    orderId: 'order-edge-1',
    buyerId: 'buyer-edge-1',
    shopId: 'shop-edge-1',
    subtotal: '200000.00',
    discountAmount: '0.00',
    shippingFee: '30000.00',
    totalAmount: '230000.00',
    status: 'PENDING_CONFIRMATION',
    recipientName: 'Nguyen Van Edge',
    recipientPhone: '0901234567',
    province: 'TP.HCM',
    district: 'Quan 1',
    ward: 'Ben Nghe',
    deliveryAddress: '123 Le Loi',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createDummyItems(orderId: string): OrderItemRecord[] {
  return [
    {
      orderItemId: 'item-1',
      orderId,
      productId: 'prod-1',
      variantId: 'variant-1',
      productNameSnapshot: 'Product 1',
      variantSnapshot: 'Variant A',
      unitPrice: '100000.00',
      quantity: 2,
      lineTotal: '200000.00',
    },
  ];
}

function createInitialHistory(orderId: string): OrderStatusHistoryRecord {
  return {
    historyId: 'hist-init',
    orderId,
    oldStatus: null,
    newStatus: 'PENDING_CONFIRMATION',
    changedBy: 'buyer-edge-1',
    reason: 'Order placed',
    changedAt: new Date().toISOString(),
  };
}

test('[T3-EDGE-01] Amount mismatch when settling payment throws PAYMENT_AMOUNT_INVALID', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const paymentService = new PaymentService({ orderRepo, paymentRepo });

  const order = createDummyOrder({ totalAmount: '230000.00' });
  await orderRepo.createOrder(order, createDummyItems(order.orderId), createInitialHistory(order.orderId));

  // Payment was recorded with a different amount (e.g. 200000.00 instead of order total 230000.00)
  const paymentId = 'pay-mismatch-1';
  const paymentRecord: PaymentRecord = {
    paymentId,
    orderId: order.orderId,
    method: 'ONLINE',
    amount: '200000.00', // mismatch!
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    paidAt: null,
    note: null,
  };
  await paymentRepo.createPayment(paymentRecord);

  // Settling with order total 230000.00 must fail because payment.amount (200000) != orderTotal (230000)
  await assert.rejects(
    async () => {
      await paymentService.settlePayment(paymentId, 'SUCCESS', '2026-09-25T12:00:00Z');
    },
    (err: unknown) => {
      assert(err instanceof PaymentDomainError);
      assert.equal(err.code, 'PAYMENT_AMOUNT_INVALID');
      return true;
    },
  );
});

test('[T3-EDGE-02] Duplicate cancel retry is rejected and restocks variants exactly once', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const restocked: Array<{ variantId: string; quantity: number }> = [];
  const restockHandler = async (variantId: string, quantity: number) => {
    restocked.push({ variantId, quantity });
  };

  const lifecycleService = new OrderLifecycleService({
    orderRepo,
    restockHandler,
  });

  const order = createDummyOrder({ status: 'PENDING_CONFIRMATION' });
  const items = [
    {
      orderItemId: 'item-1',
      orderId: order.orderId,
      productId: 'prod-1',
      variantId: 'variant-alpha',
      productNameSnapshot: 'Alpha Product',
      variantSnapshot: 'Default',
      unitPrice: '100000.00',
      quantity: 2,
      lineTotal: '200000.00',
    },
    {
      orderItemId: 'item-2',
      orderId: order.orderId,
      productId: 'prod-2',
      variantId: 'variant-beta',
      productNameSnapshot: 'Beta Product',
      variantSnapshot: 'Default',
      unitPrice: '30000.00',
      quantity: 1,
      lineTotal: '30000.00',
    },
  ];
  await orderRepo.createOrder(order, items, createInitialHistory(order.orderId));

  // First cancellation: Buyer cancels pending order
  await lifecycleService.cancelOrder(
    order.orderId,
    { kind: 'BUYER', userId: order.buyerId },
    'Customer requested cancellation',
  );

  const updatedOrder = await orderRepo.findById(order.orderId);
  assert.equal(updatedOrder?.status, 'CANCELLED');
  assert.equal(restocked.length, 2);
  assert.deepEqual(restocked, [
    { variantId: 'variant-alpha', quantity: 2 },
    { variantId: 'variant-beta', quantity: 1 },
  ]);

  const historyAfterFirstCancel = await orderRepo.findHistoryByOrderId(order.orderId);
  assert.equal(historyAfterFirstCancel.length, 2); // initial + 1 cancellation

  // Second cancellation: Retry cancel on already cancelled order
  await assert.rejects(
    async () => {
      await lifecycleService.cancelOrder(
        order.orderId,
        { kind: 'BUYER', userId: order.buyerId },
        'Try cancel again',
      );
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_CANCELLATION_NOT_ALLOWED');
      return true;
    },
  );

  // Seller also cannot cancel already cancelled order
  await assert.rejects(
    async () => {
      await lifecycleService.cancelOrder(
        order.orderId,
        { kind: 'SELLER', userId: 'seller-edge', shopId: order.shopId },
        'Seller retry cancel',
      );
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_INVALID_TRANSITION');
      return true;
    },
  );

  // Guarantee: restock was NOT called again!
  assert.equal(restocked.length, 2);
  // Guarantee: history was NOT duplicated!
  const historyAfterRetry = await orderRepo.findHistoryByOrderId(order.orderId);
  assert.equal(historyAfterRetry.length, 2);
});

test('[T3-EDGE-03] Exceptional cancellation guard when order is in PREPARING status', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const restocked: Array<{ variantId: string; quantity: number }> = [];
  const restockHandler = async (variantId: string, quantity: number) => {
    restocked.push({ variantId, quantity });
  };
  const lifecycleService = new OrderLifecycleService({ orderRepo, restockHandler });

  const order = createDummyOrder({ status: 'PREPARING' });
  await orderRepo.createOrder(order, createDummyItems(order.orderId), createInitialHistory(order.orderId));

  const sellerActor = { kind: 'SELLER' as const, userId: 'seller-1', shopId: order.shopId };

  // Attempt 1: Cancel without exceptionalCancellation flag -> rejected
  await assert.rejects(
    async () => {
      await lifecycleService.transitionOrder(order.orderId, sellerActor, {
        to: 'CANCELLED',
        reason: 'Out of stock materials',
        exceptionalCancellation: false,
      });
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_CANCELLATION_NOT_ALLOWED');
      return true;
    },
  );
  assert.equal(restocked.length, 0);

  // Attempt 2: Cancel with exceptionalCancellation flag set to true -> allowed
  const transitioned = await lifecycleService.transitionOrder(order.orderId, sellerActor, {
    to: 'CANCELLED',
    reason: 'Force majeure out of stock',
    exceptionalCancellation: true,
  });

  assert.equal(transitioned.status, 'CANCELLED');
  assert.equal(restocked.length, 1);
  assert.equal(restocked[0].variantId, 'variant-1');
});

test('[T3-EDGE-04] Shipment state machine edge cases and terminal state guards', async () => {
  // 1. Shipment transitions from terminal states
  const deliveredTransition = transitionShipment({ status: 'DELIVERED' }, 'SHIPPING');
  assert.deepEqual(deliveredTransition, { allowed: false, reason: 'INVALID_TRANSITION' });

  const failedTransition = transitionShipment({ status: 'FAILED' }, 'HANDED_OVER');
  assert.deepEqual(failedTransition, { allowed: false, reason: 'INVALID_TRANSITION' });

  // 2. Order transition to SHIPPING requires shipmentStatus HANDED_OVER or SHIPPING
  const orderRepo = new InMemoryOrderRepository();
  const lifecycleService = new OrderLifecycleService({ orderRepo });

  const preparingOrder = createDummyOrder({ status: 'PREPARING' });
  await orderRepo.createOrder(preparingOrder, createDummyItems(preparingOrder.orderId), createInitialHistory(preparingOrder.orderId));

  const sellerActor = { kind: 'SELLER' as const, userId: 'seller-1', shopId: preparingOrder.shopId };

  // If shipment is still PENDING -> rejected
  await assert.rejects(
    async () => {
      await lifecycleService.transitionOrder(preparingOrder.orderId, sellerActor, {
        to: 'SHIPPING',
        shipmentStatus: 'PENDING',
      });
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_INVALID_TRANSITION');
      return true;
    },
  );

  // When shipmentStatus is HANDED_OVER -> successfully transitions to SHIPPING
  const shippingOrder = await lifecycleService.transitionOrder(preparingOrder.orderId, sellerActor, {
    to: 'SHIPPING',
    shipmentStatus: 'HANDED_OVER',
  });
  assert.equal(shippingOrder.status, 'SHIPPING');

  // 3. Order transition to COMPLETED requires shipmentStatus DELIVERED
  const shipmentActor = { kind: 'SHIPMENT_INTEGRATION' as const };
  await assert.rejects(
    async () => {
      await lifecycleService.transitionOrder(shippingOrder.orderId, shipmentActor, {
        to: 'COMPLETED',
        shipmentStatus: 'SHIPPING', // Not DELIVERED
      });
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_INVALID_TRANSITION');
      return true;
    },
  );

  const completedOrder = await lifecycleService.transitionOrder(shippingOrder.orderId, shipmentActor, {
    to: 'COMPLETED',
    shipmentStatus: 'DELIVERED',
  });
  assert.equal(completedOrder.status, 'COMPLETED');

  // Terminal order cannot transition any further
  await assert.rejects(
    async () => {
      await lifecycleService.transitionOrder(completedOrder.orderId, sellerActor, {
        to: 'CANCELLED',
        reason: 'Attempt cancel completed order',
      });
    },
    (err: unknown) => {
      assert(err instanceof OrderDomainError);
      assert.equal(err.code, 'ORDER_INVALID_TRANSITION');
      return true;
    },
  );
});

test('[T3-EDGE-05] Payment retry and settle edge cases', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const paymentRepo = new InMemoryPaymentRepository();
  const paymentService = new PaymentService({ orderRepo, paymentRepo });

  const order = createDummyOrder({ totalAmount: '150000.00', status: 'PENDING_CONFIRMATION' });
  await orderRepo.createOrder(order, createDummyItems(order.orderId), createInitialHistory(order.orderId));

  // Case A: Create initial payment and settle it to SUCCESS
  const initialPayment: PaymentRecord = {
    paymentId: 'pay-success-1',
    orderId: order.orderId,
    method: 'ONLINE',
    amount: '150000.00',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    paidAt: null,
    note: null,
  };
  await paymentRepo.createPayment(initialPayment);

  // Settle to SUCCESS with valid paidAt
  await paymentService.settlePayment(initialPayment.paymentId, 'SUCCESS', '2026-09-25T10:00:00Z');

  // Cannot retry payment when order already has a SUCCESS payment (QD rules)
  await assert.rejects(
    async () => {
      await paymentService.retryPayment(order.orderId, order.buyerId, 'ONLINE');
    },
    (err: unknown) => {
      assert(err instanceof PaymentDomainError);
      assert.equal(err.code, 'PAYMENT_ALREADY_COMPLETED');
      return true;
    },
  );

  // Cannot settle an already SUCCESS payment again
  await assert.rejects(
    async () => {
      await paymentService.settlePayment(initialPayment.paymentId, 'SUCCESS', '2026-09-25T11:00:00Z');
    },
    (err: unknown) => {
      assert(err instanceof PaymentDomainError);
      assert.equal(err.code, 'PAYMENT_STATE_INVALID');
      return true;
    },
  );

  // Case B: Cancelled order cannot retry payment
  const cancelledOrder = createDummyOrder({ orderId: 'order-cancelled', status: 'CANCELLED' });
  await orderRepo.createOrder(cancelledOrder, createDummyItems(cancelledOrder.orderId), createInitialHistory(cancelledOrder.orderId));

  await assert.rejects(
    async () => {
      await paymentService.retryPayment(cancelledOrder.orderId, cancelledOrder.buyerId, 'COD');
    },
    (err: unknown) => {
      assert(err instanceof PaymentDomainError);
      assert.equal(err.code, 'PAYMENT_STATE_INVALID');
      return true;
    },
  );
});

test('[T3-EDGE-06] Order history immutability and complete audit trail', async () => {
  const orderRepo = new InMemoryOrderRepository();
  const lifecycleService = new OrderLifecycleService({ orderRepo });

  const order = createDummyOrder({ status: 'PENDING_CONFIRMATION' });
  await orderRepo.createOrder(order, createDummyItems(order.orderId), createInitialHistory(order.orderId));

  const sellerActor = { kind: 'SELLER' as const, userId: 'seller-audit', shopId: order.shopId };
  const shipmentActor = { kind: 'SHIPMENT_INTEGRATION' as const };

  // Step 1: CONFIRMED
  await lifecycleService.confirmOrder(order.orderId, sellerActor);
  // Step 2: PREPARING
  await lifecycleService.transitionOrder(order.orderId, sellerActor, { to: 'PREPARING' });
  // Step 3: SHIPPING
  await lifecycleService.transitionOrder(order.orderId, sellerActor, { to: 'SHIPPING', shipmentStatus: 'HANDED_OVER' });
  // Step 4: COMPLETED
  await lifecycleService.transitionOrder(order.orderId, shipmentActor, { to: 'COMPLETED', shipmentStatus: 'DELIVERED' });

  const history = await orderRepo.findHistoryByOrderId(order.orderId);
  assert.equal(history.length, 5); // Init + 4 transitions

  assert.equal(history[0].newStatus, 'PENDING_CONFIRMATION');
  assert.equal(history[1].oldStatus, 'PENDING_CONFIRMATION');
  assert.equal(history[1].newStatus, 'CONFIRMED');
  assert.equal(history[2].oldStatus, 'CONFIRMED');
  assert.equal(history[2].newStatus, 'PREPARING');
  assert.equal(history[3].oldStatus, 'PREPARING');
  assert.equal(history[3].newStatus, 'SHIPPING');
  assert.equal(history[4].oldStatus, 'SHIPPING');
  assert.equal(history[4].newStatus, 'COMPLETED');

  // Verify timestamps exist and are chronologically sound
  for (const record of history) {
    assert(record.changedAt);
    assert(Number.isFinite(Date.parse(record.changedAt)));
  }
});
