import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transitionOrder } from '../../../src/modules/order/domain/order-state-machine.ts';
import type { OrderActor, OrderStatus } from '../../../src/modules/order/domain/types.ts';

test('[QD11/QD13] An unknown runtime actor cannot authorize an Order transition', () => {
  const order = { status: 'PENDING_CONFIRMATION' as const, buyerId: 'buyer-a', shopId: 'shop-a' };
  assert.throws(() => transitionOrder(order, {
    to: 'CONFIRMED', actor: { kind: 'UNKNOWN' } as unknown as OrderActor,
    processingEligible: true,
  }), { code: 'RESOURCE_FORBIDDEN' });
});

test('[QD11] Seller confirms an eligible Order without mutating its snapshot', () => {
  const order = Object.freeze({
    status: 'PENDING_CONFIRMATION' as const,
    buyerId: 'buyer-a',
    shopId: 'shop-a',
    totalAmount: '100000.00',
  });
  const result = transitionOrder(order, {
    to: 'CONFIRMED',
    actor: { kind: 'SELLER', userId: 'seller-a', shopId: 'shop-a' },
    processingEligible: true,
  });
  assert.deepEqual(result, { from: 'PENDING_CONFIRMATION', to: 'CONFIRMED' });
  assert.equal(order.status, 'PENDING_CONFIRMATION');
  assert.equal(order.totalAmount, '100000.00');
});

test('[QD12/QD13] Actors can only transition Orders within their ownership and role', () => {
  const order = Object.freeze({ status: 'PENDING_CONFIRMATION' as const, buyerId: 'buyer-a', shopId: 'shop-a' });
  const buyer: OrderActor = { kind: 'BUYER', userId: 'buyer-a' };
  assert.equal(transitionOrder(order, { to: 'CANCELLED', actor: buyer, reason: 'Changed mind' }).to, 'CANCELLED');
  assert.throws(() => transitionOrder(order, {
    to: 'CANCELLED', actor: { kind: 'BUYER', userId: 'buyer-b' }, reason: 'Changed mind',
  }), { code: 'RESOURCE_NOT_FOUND' });
  assert.throws(() => transitionOrder(order, {
    to: 'CONFIRMED', actor: { kind: 'SELLER', userId: 'seller-b', shopId: 'shop-b' }, processingEligible: true,
  }), { code: 'RESOURCE_FORBIDDEN' });
  assert.throws(() => transitionOrder(order, {
    to: 'CONFIRMED', actor: buyer, processingEligible: true,
  }), { code: 'RESOURCE_FORBIDDEN' });
  for (const status of ['CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED'] as const) {
    assert.throws(() => transitionOrder({ ...order, status }, {
      to: 'CANCELLED', actor: buyer, reason: 'Changed mind',
    }), { code: 'ORDER_CANCELLATION_NOT_ALLOWED' });
  }
  assert.equal(transitionOrder({ ...order, status: 'SHIPPING' }, {
    to: 'COMPLETED', actor: { kind: 'SHIPMENT_INTEGRATION' }, shipmentStatus: 'DELIVERED',
  }).to, 'COMPLETED');
  assert.throws(() => transitionOrder({ ...order, status: 'SHIPPING' }, {
    to: 'COMPLETED', actor: { kind: 'SELLER', userId: 'seller-a', shopId: 'shop-a' }, shipmentStatus: 'DELIVERED',
  }), { code: 'RESOURCE_FORBIDDEN' });
  assert.throws(() => transitionOrder(order, {
    to: 'CONFIRMED', actor: { kind: 'SHIPMENT_INTEGRATION' }, processingEligible: true,
  }), { code: 'RESOURCE_FORBIDDEN' });
});

test('[QD11] Only the eight documented edges are allowed, including terminal states', () => {
  const statuses: OrderStatus[] = [
    'PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING',
    'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED',
  ];
  // Independent specification: order-workflow-transactions.md section 2.
  const allowed = new Set([
    'PENDING_CONFIRMATION:CONFIRMED', 'PENDING_CONFIRMATION:CANCELLED',
    'CONFIRMED:PREPARING', 'CONFIRMED:CANCELLED',
    'PREPARING:SHIPPING', 'PREPARING:CANCELLED',
    'SHIPPING:COMPLETED', 'SHIPPING:DELIVERY_FAILED',
  ]);
  for (const from of statuses) {
    for (const to of statuses) {
      const run = () => transitionOrder(
        { status: from, buyerId: 'buyer-a', shopId: 'shop-a' },
        {
          to, actor: { kind: 'ADMIN', userId: 'admin-a' }, reason: 'Reviewed',
          processingEligible: true, exceptionalCancellation: true,
          shipmentStatus: to === 'COMPLETED' ? 'DELIVERED'
            : to === 'DELIVERY_FAILED' ? 'FAILED' : 'HANDED_OVER',
        },
      );
      if (allowed.has(`${from}:${to}`)) {
        assert.equal(run().to, to, `${from} -> ${to}`);
      } else {
        assert.throws(run, { code: 'ORDER_INVALID_TRANSITION' }, `${from} -> ${to}`);
      }
    }
  }
});

test('[RB-LTT08] Cancellation and Admin intervention require a nonblank trimmed reason', () => {
  const order = Object.freeze({ status: 'PENDING_CONFIRMATION' as const, buyerId: 'buyer-a', shopId: 'shop-a' });
  for (const reason of [undefined, '', '   ']) {
    assert.throws(() => transitionOrder(order, {
      to: 'CANCELLED', actor: { kind: 'BUYER', userId: 'buyer-a' }, reason,
    }), { code: 'REASON_REQUIRED' });
    assert.throws(() => transitionOrder(order, {
      to: 'CONFIRMED', actor: { kind: 'ADMIN', userId: 'admin-a' }, reason, processingEligible: true,
    }), { code: 'REASON_REQUIRED' });
  }
  assert.deepEqual(transitionOrder(order, {
    to: 'CANCELLED', actor: { kind: 'BUYER', userId: 'buyer-a' }, reason: '  Changed mind  ',
  }), { from: 'PENDING_CONFIRMATION', to: 'CANCELLED', reason: 'Changed mind' });
  assert.equal(order.status, 'PENDING_CONFIRMATION');
});

test('[QD11] Confirmation, exceptional cancellation and delivery require verified evidence', () => {
  const order = { buyerId: 'buyer-a', shopId: 'shop-a' };
  const seller = { kind: 'SELLER' as const, userId: 'seller-a', shopId: 'shop-a' };
  for (const processingEligible of [undefined, false]) {
    assert.throws(() => transitionOrder({ ...order, status: 'PENDING_CONFIRMATION' }, {
      to: 'CONFIRMED', actor: seller, processingEligible,
    }), { code: 'ORDER_INVALID_TRANSITION' });
  }
  assert.throws(() => transitionOrder({ ...order, status: 'PREPARING' }, {
    to: 'CANCELLED', actor: seller, reason: 'Unable to fulfil',
  }), { code: 'ORDER_CANCELLATION_NOT_ALLOWED' });
  assert.equal(transitionOrder({ ...order, status: 'PREPARING' }, {
    to: 'CANCELLED', actor: seller, reason: 'Unable to fulfil', exceptionalCancellation: true,
  }).to, 'CANCELLED');
  for (const shipmentStatus of [undefined, 'PENDING', 'FAILED', 'DELIVERED'] as const) {
    assert.throws(() => transitionOrder({ ...order, status: 'PREPARING' }, {
      to: 'SHIPPING', actor: seller, shipmentStatus,
    }), { code: 'ORDER_INVALID_TRANSITION' });
  }
  for (const shipmentStatus of ['HANDED_OVER', 'SHIPPING'] as const) {
    assert.equal(transitionOrder({ ...order, status: 'PREPARING' }, {
      to: 'SHIPPING', actor: seller, shipmentStatus,
    }).to, 'SHIPPING');
  }
  for (const shipmentStatus of [undefined, 'PENDING', 'HANDED_OVER', 'SHIPPING', 'FAILED'] as const) {
    assert.throws(() => transitionOrder({ ...order, status: 'SHIPPING' }, {
      to: 'COMPLETED', actor: { kind: 'SHIPMENT_INTEGRATION' }, shipmentStatus,
    }), { code: 'ORDER_INVALID_TRANSITION' });
  }
  assert.throws(() => transitionOrder({ ...order, status: 'SHIPPING' }, {
    to: 'DELIVERY_FAILED', actor: { kind: 'SHIPMENT_INTEGRATION' }, shipmentStatus: 'DELIVERED', reason: 'Failed',
  }), { code: 'ORDER_INVALID_TRANSITION' });
  for (const reason of [undefined, '', '   ']) {
    assert.throws(() => transitionOrder({ ...order, status: 'SHIPPING' }, {
      to: 'DELIVERY_FAILED', actor: { kind: 'SHIPMENT_INTEGRATION' }, shipmentStatus: 'FAILED', reason,
    }), { code: 'REASON_REQUIRED' });
  }
  assert.equal(transitionOrder({ ...order, status: 'SHIPPING' }, {
    to: 'DELIVERY_FAILED', actor: { kind: 'SHIPMENT_INTEGRATION' }, shipmentStatus: 'FAILED', reason: 'Recipient unavailable',
  }).to, 'DELIVERY_FAILED');
});

test('[RB-MG12] Unknown statuses are rejected as validation errors', () => {
  for (const invalid of ['UNKNOWN', 'toString', '', null]) {
    const order = Object.freeze({ status: 'PENDING_CONFIRMATION' as OrderStatus, buyerId: 'buyer-a', shopId: 'shop-a' });
    const command = { to: 'CONFIRMED' as OrderStatus, actor: { kind: 'ADMIN' as const, userId: 'admin-a' }, reason: 'Reviewed', processingEligible: true };
    assert.throws(() => transitionOrder({ ...order, status: invalid as OrderStatus }, command), { code: 'VALIDATION_FAILED' });
    assert.throws(() => transitionOrder(order, { ...command, to: invalid as OrderStatus }), { code: 'VALIDATION_FAILED' });
    assert.equal(order.status, 'PENDING_CONFIRMATION');
  }
});
