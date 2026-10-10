import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalCheckoutFingerprint } from '../../../src/modules/checkout/repositories/pg-idempotency.repository.ts';

describe('checkout idempotency canonicalization', () => {
  it('is independent of voucher input order and ignores the idempotency key', () => {
    const first = canonicalCheckoutFingerprint({
      address_id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
      payment_method: 'COD',
      vouchers: [
        { shop_id: 'BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB', code: ' SAVE10 ' },
        { shop_id: 'CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC', code: 'VIP' },
      ],
    });
    const second = canonicalCheckoutFingerprint({
      address_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payment_method: 'COD',
      vouchers: [
        { shop_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', code: 'VIP' },
        { shop_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', code: 'SAVE10' },
      ],
    });
    assert.equal(first, second);
    assert.match(first, /^[0-9a-f]{64}$/);
  });
});
