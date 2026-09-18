import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotals } from '../../../src/modules/order/domain/order-calculation.ts';

test('[RB-MG06] Quantity fits the Schema Freeze PostgreSQL INTEGER domain', () => {
  const input = {
    lines: [{ unit_price: '0.01', quantity: 2_147_483_647 }],
    discount_amount: '0.00', shipping_fee: '0.00',
  };
  assert.equal(calculateOrderTotals(input).total_amount, '21474836.47');
  assert.throws(() => calculateOrderTotals({
    ...input, lines: [{ unit_price: '0.01', quantity: 2_147_483_648 }],
  }), { code: 'ORDER_TOTAL_INVALID' });
});

test('[RB-LTT01/RB-LTT02] Calculates exact line totals and Order totals without floating-point drift', () => {
  assert.deepEqual(calculateOrderTotals({
    lines: [
      { unit_price: '1.10', quantity: 3 },
      { unit_price: '2.25', quantity: 2 },
    ],
    discount_amount: '1.25',
    shipping_fee: '0.50',
  }), {
    line_totals: ['3.30', '4.50'],
    subtotal: '7.80',
    discount_amount: '1.25',
    shipping_fee: '0.50',
    total_amount: '7.05',
  });
});

test('[QD10/RB-MG06/RB-MG07] Rejects invalid line quantities, money and negative totals', () => {
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '10.00', quantity: 0 }],
    discount_amount: '0.00',
    shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '10.001', quantity: 1 }],
    discount_amount: '0.00',
    shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '10.00', quantity: 1 }],
    discount_amount: '10.01',
    shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
});

test('[RB-LQH01] Requires at least one line and preserves the NUMERIC(15,2) range', () => {
  assert.throws(() => calculateOrderTotals({
    lines: [],
    discount_amount: '0.00',
    shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '9999999999999.99', quantity: 2 }],
    discount_amount: '0.00',
    shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
});

test('[QD10/RB-MG07] Zero total and maximum NUMERIC(15,2) total remain exact', () => {
  const input = Object.freeze({
    lines: Object.freeze([Object.freeze({ unit_price: '9999999999999.99', quantity: 1 })]),
    discount_amount: '0.00', shipping_fee: '0.00',
  });
  assert.deepEqual(calculateOrderTotals(input), {
    line_totals: ['9999999999999.99'], subtotal: '9999999999999.99',
    discount_amount: '0.00', shipping_fee: '0.00', total_amount: '9999999999999.99',
  });
  assert.equal(calculateOrderTotals({ ...input, discount_amount: '9999999999999.99' }).total_amount, '0.00');
});

test('[RB-LQH01/RB-MG07] Subtotal and final total overflow are rejected independently', () => {
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '9999999999999.99', quantity: 1 }, { unit_price: '0.01', quantity: 1 }],
    discount_amount: '0.01', shipping_fee: '0.00',
  }), { code: 'ORDER_TOTAL_INVALID' });
  assert.throws(() => calculateOrderTotals({
    lines: [{ unit_price: '9999999999999.99', quantity: 1 }],
    discount_amount: '0.00', shipping_fee: '0.01',
  }), { code: 'ORDER_TOTAL_INVALID' });
});

test('[RB-MG06/RB-MG07] Each monetary input and quantity reject invalid domains', () => {
  const input = { lines: [{ unit_price: '1.00', quantity: 1 }], discount_amount: '0.00', shipping_fee: '0.00' };
  for (const unit_price of ['0.00', '-0.01', '1e2', 'NaN', '10000000000000.00']) {
    assert.throws(() => calculateOrderTotals({ ...input, lines: [{ unit_price, quantity: 1 }] }), { code: 'ORDER_TOTAL_INVALID' });
  }
  for (const quantity of [-1, 0, 1.5, NaN, Infinity]) {
    assert.throws(() => calculateOrderTotals({ ...input, lines: [{ unit_price: '1.00', quantity }] }), { code: 'ORDER_TOTAL_INVALID' });
  }
  for (const field of ['discount_amount', 'shipping_fee'] as const) {
    for (const value of ['-0.01', '0.001', 'NaN', '1e2', '10000000000000.00']) {
      assert.throws(() => calculateOrderTotals({ ...input, [field]: value }), { code: 'ORDER_TOTAL_INVALID' });
    }
  }
});
