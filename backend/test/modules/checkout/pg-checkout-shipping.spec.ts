import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { PgCheckoutService } from '../../../src/modules/checkout/services/pg-checkout.service.ts';
import { GhtkFeeProvider } from '../../../src/modules/shipping/providers.ts';
import type { RequestContext } from '../../../src/contracts/request-context.contract.ts';

const context: RequestContext = { user_id: 'buyer-1', role: 'BUYER', request_id: 'req-ghtk-test' };
const address = { province: 'Đồng Tháp', ward: 'Hồng Ngự', district: 'Ấp An Thịnh', detail_address: 'Ấp An Thịnh' };
const cart = [{ shop_id: 'shop-1', pickup_address: 'Kho', pickup_detail_address: 'Kho số 1', pickup_province: 'Đồng Tháp', pickup_ward: 'Hồng Ngự', weight_grams: 800 }];

function poolStub() {
  let transactionStarted = false;
  let persistedShippingFee: string | undefined;
  const pool = {
    async query(sql: string) {
      if (sql.includes('api_idempotency_records')) return { rows: [] };
      if (sql.includes('FROM addresses')) return { rows: [address] };
      if (sql.includes('FROM cart_items')) return { rows: cart };
      throw new Error(`Unexpected query: ${sql}`);
    },
    async connect() {
      transactionStarted = true;
      return {
        async query(sql: string, params?: unknown[]) {
          if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ acquired: true }] };
          if (sql.includes('SELECT fingerprint, result FROM api_idempotency_records')) return { rows: [] };
          if (sql.includes('FROM addresses')) return { rows: [address] };
          if (sql.includes('FROM cart_items')) return { rows: [{
            cart_item_id: 'cart-item-1', variant_id: 'variant-1', quantity: 1, price: '100000.00', stock_quantity: 5,
            weight_grams: 800, variant_status: 'ACTIVE', product_id: 'product-1', product_name: 'Test product',
            variant_name: 'Default', variant_value: null, shop_id: 'shop-1', shop_owner_id: 'seller-1',
          }] };
          if (sql.includes('SELECT status FROM shops')) return { rows: [{ status: 'ACTIVE' }] };
          if (sql.includes('INSERT INTO orders')) persistedShippingFee = String(params?.[11]);
          if (sql.startsWith('UPDATE product_variants')) return { rows: [], rowCount: 1 };
          return { rows: [] };
        },
        release() {},
      };
    },
  } as unknown as Pool;
  return { pool, transactionStarted: () => transactionStarted, persistedShippingFee: () => persistedShippingFee };
}

describe('PgCheckoutService GHTK shipping', () => {
  it('quotes using province, ward, weight and a deduplicated detailed address', async () => {
    const { pool } = poolStub();
    let requestUrl = '';
    const ghtk = new GhtkFeeProvider({
      baseUrl: 'https://services.giaohangtietkiem.vn',
      token: 'test-token',
      fetcher: async input => {
        requestUrl = String(input);
        return Response.json({ success: true, fee: { fee: 30400, delivery: true } });
      },
    });
    const service = new PgCheckoutService(pool, async () => {}, ghtk);

    const result = await service.quoteShipping(context, { address_id: 'address-1' }) as { quotes: Array<{ fee: string }> };
    const url = new URL(requestUrl);
    assert.equal(url.searchParams.get('province'), 'Đồng Tháp');
    assert.equal(url.searchParams.get('ward'), 'Hồng Ngự');
    assert.equal(url.searchParams.get('address'), 'Ấp An Thịnh');
    assert.equal(url.searchParams.get('weight'), '800');
    assert.deepEqual(result.quotes.map(quote => quote.fee), ['30400.00']);
  });

  it('allows simulated checkout with GHTK fee when delivery is false', async () => {
    const stub = poolStub();
    const ghtk = new GhtkFeeProvider({
      baseUrl: 'https://services.giaohangtietkiem.vn',
      token: 'test-token',
      fetcher: async () => Response.json({ success: true, fee: { fee: 40700, delivery: false } }),
    });
    const service = new PgCheckoutService(stub.pool, async () => {}, ghtk);

    const result = await service.createOrder(context, {
      idempotency_key: 'ghtk-no-delivery-1234',
      address_id: 'address-1',
      payment_method: 'COD',
      vouchers: [],
      expected_shipping_fees: [{ shop_id: 'shop-1', fee: '40700.00' }],
    });
    assert.equal(stub.transactionStarted(), true);
    assert.equal(stub.persistedShippingFee(), '40700.00');
    assert.equal(result.orders.length, 1);
  });
});
