import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCheckoutCommand } from '../../../src/modules/checkout/contracts/checkout-command.ts';

const addressId = '93f6d90c-82f4-4bad-a389-10e6f02788d2';
const shopId = 'a3f6d90c-82f4-4bad-a389-10e6f02788d2';

test('[API §2] Checkout accepts an address, method and optional voucher per shop without mutating input', () => {
  const body = Object.freeze({ address_id: addressId, payment_method: 'COD' });
  assert.deepEqual(parseCheckoutCommand(body, '1234567890123456'), {
    address_id: addressId, payment_method: 'COD', vouchers: [], idempotency_key: '1234567890123456',
  });
  assert.deepEqual(parseCheckoutCommand({ address_id: addressId, payment_method: 'ONLINE', vouchers: [{ shop_id: shopId, code: 'SAVE10' }] }, 'k'.repeat(128)), {
    address_id: addressId, payment_method: 'ONLINE', vouchers: [{ shop_id: shopId, code: 'SAVE10' }], idempotency_key: 'k'.repeat(128),
  });
});

test('[API §2/§6] Idempotency key is mandatory and has 16–128 characters', () => {
  const body = { address_id: addressId, payment_method: 'COD' };
  for (const key of [undefined, null, '']) {
    assert.throws(() => parseCheckoutCommand(body, key), { code: 'IDEMPOTENCY_KEY_REQUIRED' });
  }
  for (const key of ['k'.repeat(15), 'k'.repeat(129), 12345]) {
    assert.throws(() => parseCheckoutCommand(body, key), { code: 'VALIDATION_FAILED' });
  }
});

test('[API §2/RB-LB07] Invalid bodies, untrusted prices and duplicate shop vouchers are rejected', () => {
  const valid = { address_id: addressId, payment_method: 'COD' };
  const invalidBodies: unknown[] = [
    null, [], 'body', {}, { ...valid, address_id: 'not-uuid' },
    { ...valid, address_id: addressId.toUpperCase() }, { ...valid, payment_method: 'CARD' },
    { ...valid, total_amount: '1.00' }, { ...valid, buyer_id: addressId }, { ...valid, price: '1.00' },
    { ...valid, vouchers: null }, { ...valid, vouchers: {} },
    { ...valid, vouchers: [null] }, { ...valid, vouchers: [{ shop_id: 'bad', code: 'SAVE' }] },
    { ...valid, vouchers: [{ shop_id: shopId, code: '   ' }] },
    { ...valid, vouchers: [{ shop_id: shopId, code: 'X'.repeat(51) }] },
    { ...valid, vouchers: [{ shop_id: shopId, code: 'SAVE', discount_amount: '10.00' }] },
    { ...valid, vouchers: [{ shop_id: shopId, code: 'A' }, { shop_id: shopId, code: 'B' }] },
  ];
  for (const body of invalidBodies) {
    assert.throws(() => parseCheckoutCommand(body, '1234567890123456'), { code: 'VALIDATION_FAILED' });
  }
});
