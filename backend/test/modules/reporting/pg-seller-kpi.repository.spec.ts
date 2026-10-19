import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { PgSellerKpiRepository } from '../../../src/modules/reporting/repositories/pg-seller-kpi.repository.ts';

describe('PgSellerKpiRepository', () => {
  it('returns the shop average rating rounded to one decimal place', async () => {
    const pool = {
      query: async () => ({
        rows: [{
          shop_id: 'shop-1', shop_name: 'Dino Store', total_revenue: '0',
          completed_orders_count: 0, pending_orders_count: 0, active_products_count: 0,
          average_rating: 3.6666666667,
        }],
      }),
    } as unknown as Pool;

    const result = await new PgSellerKpiRepository(pool).getForShop('shop-1');

    assert.equal(result?.averageRating, 3.7);
  });
});
