import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

const shopId = '00000000-0000-0000-0000-000000000010';
const sellerId = '00000000-0000-0000-0000-000000000011';

describe('Seller shop profile HTTP behavior', () => {
  it('lets a pending seller read and update only their own shop profile', async () => {
    const calls: unknown[] = [];
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({ request_id: 'req_test', user_id: sellerId, role: 'SELLER', shop_id: shopId, shop_status: 'PENDING' });
        next();
      },
      sellerShop: {
        get: async () => ({ shop_id: shopId, status: 'PENDING', shop_name: 'My Shop', description: null, pickup_address: null, contact_phone: null, updated_at: '2026-10-01T00:00:00.000Z' }),
        update: async (_context, input) => {
          calls.push([shopId, input]);
          return { shop_id: shopId, status: 'PENDING', shop_name: 'My Shop', description: null, pickup_address: null, contact_phone: null, updated_at: '2026-10-01T00:00:00.000Z', ...input };
        },
      },
    });

    const read = await request(app).get('/api/v1/seller/shop').expect(200);
    assert.equal(read.body.data.shop_id, shopId);
    await request(app).patch('/api/v1/seller/shop').send({ pickup_address: 'District 1, Ho Chi Minh City', contact_phone: '0901234567' }).expect(200);
    assert.deepEqual(calls, [[shopId, { pickup_address: 'District 1, Ho Chi Minh City', contact_phone: '0901234567' }]]);
  });
});
