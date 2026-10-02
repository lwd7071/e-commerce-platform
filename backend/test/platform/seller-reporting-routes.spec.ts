import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';

describe('Seller revenue report HTTP behavior', () => {
  it('forwards only date filters and derives Shop scope from the authenticated Seller context', async () => {
    const shopId = '00000000-0000-4000-8000-000000000010';
    const filters: Array<{ from?: string; to?: string } | undefined> = [];
    const app = createApp({
      auth: (req, _res, next) => { req.context = createRequestContext({ request_id: 'req_report', user_id: '00000000-0000-4000-8000-000000000011', role: 'SELLER', shop_id: shopId, shop_status: 'ACTIVE' }); next(); },
      sellerRevenue: { get: async (context, filter) => { assert.equal(context.shop_id, shopId); filters.push(filter); return { shopId, totalOrders: 2, completedOrders: 1, cancelledOrders: 1, otherOrders: 0, grossRevenue: '150.00', netSubtotal: '140.00', totalDiscount: '0.00', totalShipping: '10.00', averageOrderValue: '150.00', generatedAt: '2026-10-01T00:00:00.000Z' }; } },
    });

    await request(app).get('/api/v1/seller/reports/revenue?from=2026-10-01T00:00:00Z&to=2026-10-31T23:59:59Z').expect(200);
    assert.deepEqual(filters, [{ from: '2026-10-01T00:00:00Z', to: '2026-10-31T23:59:59Z' }]);
    await request(app).get('/api/v1/seller/reports/revenue?shop_id=00000000-0000-4000-8000-000000000099').expect(422);
  });
});
