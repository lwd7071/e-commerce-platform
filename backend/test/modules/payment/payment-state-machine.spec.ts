import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settlePendingPayment, createPaymentRetry } from '../../../src/modules/payment/domain/payment-state-machine.ts';
import type { PaymentStatus, PendingPaymentOutcome } from '../../../src/modules/payment/domain/types.ts';

test('[RB-LTT06] A pending attempt can succeed with paidAt or fail without mutating the original', () => {
  const payment = Object.freeze({ paymentId: 'payment-a', orderId: 'order-a', status: 'PENDING' as const, amount: '100000.00', method: 'ONLINE' as const, paidAt: null });
  assert.deepEqual(settlePendingPayment(payment, {
    outcome: 'SUCCESS', orderTotal: '100000.00', paidAt: '2026-09-17T03:00:00.000Z',
  }), { ...payment, status: 'SUCCESS', paidAt: '2026-09-17T03:00:00.000Z' });
  assert.deepEqual(settlePendingPayment(payment, {
    outcome: 'FAILED', orderTotal: '100000.00',
  }), { ...payment, status: 'FAILED', paidAt: null });
  assert.equal(payment.status, 'PENDING');
});

test('[RB-LB10/RB-LQH04] Retry creates a new pending attempt and refuses an already paid Order', () => {
  const old = Object.freeze({ paymentId: 'old', orderId: 'order-a', status: 'FAILED' as const, method: 'ONLINE' as const, amount: '100.00', paidAt: null });
  const command = { paymentId: 'new', orderId: 'order-a', method: 'ONLINE' as const, orderTotal: '100.00' };
  assert.deepEqual(createPaymentRetry([old], command), { paymentId: 'new', orderId: 'order-a', status: 'PENDING', method: 'ONLINE', amount: '100.00', paidAt: null });
  assert.equal(old.status, 'FAILED');
  assert.throws(() => createPaymentRetry([{ ...old, status: 'SUCCESS', paidAt: '2026-09-17T03:00:00Z' }], command), { code: 'PAYMENT_ALREADY_COMPLETED' });
  assert.throws(() => createPaymentRetry([old], { ...command, paymentId: 'old' }), { code: 'PAYMENT_STATE_INVALID' });
  assert.throws(() => createPaymentRetry([old], { ...command, orderTotal: '0.00' }), { code: 'PAYMENT_AMOUNT_INVALID' });
  assert.throws(() => createPaymentRetry([old], { ...command, orderId: 'other-order' }), { code: 'PAYMENT_STATE_INVALID' });
});

test('[RB-MG10/RB-LQH04] Settlement requires a positive exact decimal amount equal to the entire Order', () => {
  const payment = { paymentId: 'p', orderId: 'o', status: 'PENDING' as const, method: 'ONLINE' as const, amount: '100000.00', paidAt: null };
  for (const amount of ['0.00', '-1.00', '99999.00', '100000garbage', '1e5', '100000.001', '10000000000000.00']) {
    assert.throws(() => settlePendingPayment({ ...payment, amount }, {
      outcome: 'SUCCESS', orderTotal: '100000.00', paidAt: '2026-09-17T03:00:00Z',
    }), { code: 'PAYMENT_AMOUNT_INVALID' });
  }
  assert.equal(settlePendingPayment({ ...payment, amount: '0.10' }, {
    outcome: 'SUCCESS', orderTotal: '0.1', paidAt: '2026-09-17T03:00:00Z',
  }).status, 'SUCCESS');
  assert.throws(() => settlePendingPayment(payment, { outcome: 'SUCCESS', orderTotal: '100000.00' }), { code: 'PAYMENT_STATE_INVALID' });
  for (const paidAt of ['', 'not-a-date', '2026-09-17T03:00:00']) {
    assert.throws(() => settlePendingPayment(payment, { outcome: 'SUCCESS', orderTotal: '100000.00', paidAt }), { code: 'PAYMENT_STATE_INVALID' });
  }
});

test('[RB-MG12] Pending settlement never reopens settled attempts or accepts unknown states', () => {
  const payment = { paymentId: 'p', orderId: 'o', status: 'PENDING' as PaymentStatus, method: 'ONLINE' as const, amount: '100.00', paidAt: null };
  for (const status of ['SUCCESS', 'FAILED'] as const) {
    for (const outcome of ['SUCCESS', 'FAILED'] as const) {
      assert.throws(() => settlePendingPayment({ ...payment, status }, {
        outcome, orderTotal: '100.00', paidAt: '2026-09-17T03:00:00Z',
      }), { code: 'PAYMENT_STATE_INVALID' });
    }
  }
  assert.throws(() => settlePendingPayment({ ...payment, status: 'UNKNOWN' as PaymentStatus }, {
    outcome: 'SUCCESS', orderTotal: '100.00', paidAt: '2026-09-17T03:00:00Z',
  }), { code: 'VALIDATION_FAILED' });
  for (const outcome of ['PENDING', 'UNKNOWN']) {
    assert.throws(() => settlePendingPayment(payment, {
      outcome: outcome as PendingPaymentOutcome['outcome'], orderTotal: '100.00',
    }), { code: 'PAYMENT_STATE_INVALID' });
  }
});
