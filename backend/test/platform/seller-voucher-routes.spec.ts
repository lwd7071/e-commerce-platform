import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

describe('Seller voucher REST behavior', () => {
  it('creates a SHOP voucher for the authenticated shop and refuses client scope overrides', async () => {
    const shopId = '00000000-0000-4000-8000-000000000010';
    const contexts: string[] = [];
    const sample = { voucher_id: 'new-voucher', code: 'SHOP10', voucher_name: 'Shop deal', scope: 'SHOP' as const, shop_id: shopId, discount_type: 'PERCENT' as const, discount_value: '10.00', max_discount: '50000.00', min_order_value: '100000.00', quantity: 25, start_at: '2026-10-01T00:00:00.000Z', end_at: '2026-12-01T00:00:00.000Z', status: 'ACTIVE' as const, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' };
    const app = createApp({
      auth: (req, _res, next) => { req.context = createRequestContext({ request_id: 'req_voucher', user_id: '00000000-0000-4000-8000-000000000011', role: 'SELLER', shop_id: shopId, shop_status: 'ACTIVE' }); next(); },
      sellerVouchers: {
        list: async () => [sample], get: async () => sample, update: async () => sample, setStatus: async () => sample,
        create: async (context, input) => {
        contexts.push(context.shop_id ?? '');
        return {
          voucher_id: 'new-voucher', code: String(input.code), voucher_name: String(input.voucher_name), scope: 'SHOP', shop_id: context.shop_id!,
          discount_type: input.discount_type as 'PERCENT' | 'FIXED', discount_value: String(input.discount_value), max_discount: input.max_discount == null ? null : String(input.max_discount),
          min_order_value: String(input.min_order_value), quantity: Number(input.quantity), start_at: String(input.start_at), end_at: String(input.end_at),
          status: 'ACTIVE', created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
        };
      } },
    });

    const valid = { code: 'SHOP10', voucher_name: 'Shop deal', discount_type: 'PERCENT', discount_value: '10.00', max_discount: '50000.00', min_order_value: '100000.00', quantity: 25, start_at: '2026-10-01T00:00:00.000Z', end_at: '2026-12-01T00:00:00.000Z' };
    const response = await request(app).post('/api/v1/seller/vouchers').send(valid).expect(201);
    assert.equal(response.body.data.scope, 'SHOP');
    assert.equal(response.body.data.shop_id, shopId);
    assert.deepEqual(contexts, [shopId]);
    await request(app).post('/api/v1/seller/vouchers').send({ ...valid, shop_id: '00000000-0000-4000-8000-000000000099' }).expect(422);
  });
});
