import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

describe('Seller KPI HTTP behavior', () => {
  it('derives the shop scope from authenticated context and rejects caller supplied shop IDs', async () => {
    const scopedShop = '00000000-0000-0000-0000-000000000010';
    const requested: string[] = [];
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({ request_id: 'req_test', user_id: '00000000-0000-0000-0000-000000000011', role: 'SELLER', shop_id: scopedShop, shop_status: 'ACTIVE' });
        next();
      },
      sellerKpi: { get: async (context) => {
        requested.push(context.shop_id ?? '');
        return { shopId: context.shop_id!, shopName: 'Seller shop', totalRevenue: '125.00', completedOrdersCount: 1, pendingOrdersCount: 0, activeProductsCount: 2, averageRating: 4.5 };
      } },
    });

    await request(app).get('/api/v1/seller/kpi?shop_id=00000000-0000-0000-0000-000000000099').expect(422);
    const response = await request(app).get('/api/v1/seller/kpi').expect(200);
    assert.deepEqual(requested, [scopedShop]);
    assert.equal(response.body.data.shopId, scopedShop);
  });
});
