import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { OrderQueryService } from '../../../src/modules/order/services/order-query.service.ts';
import { InMemoryOrderRepository } from '../../../src/modules/order/repositories/in-memory-order.repository.ts';

describe('Admin order query', () => {
  it('applies whitelisted filters with bound values and returns payment/shipment/history detail', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const pool = { query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('SELECT o.order_id')) return { rows: [{ order_id: '00000000-0000-4000-8000-000000000001', buyer_id: '00000000-0000-4000-8000-000000000002', buyer_email: 'buyer@example.test', shop_id: '00000000-0000-4000-8000-000000000003', shop_name: 'Shop', status: 'SHIPPING', subtotal: '100.00', discount_amount: '0.00', shipping_fee: '0.00', total_amount: '100.00', cancel_reason: null, created_at: new Date('2026-10-02T00:00:00Z'), updated_at: new Date('2026-10-02T00:00:00Z') }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    } } as unknown as Pool;
    const service = new OrderQueryService(new InMemoryOrderRepository(), pool);
    const page = await service.listAdminOrdersPaginated({ request_id: 'req', user_id: 'admin-1', role: 'ADMIN' }, {
      status: 'SHIPPING', search: 'buyer@example.test', shop_id: '00000000-0000-4000-8000-000000000003', from: '2026-10-01T00:00:00Z', to: '2026-10-03T00:00:00Z', limit: 10,
    });
    const list = calls[0];
    assert.match(list.sql, /buyer\.email ILIKE/);
    assert.match(list.sql, /o\.created_at >=/);
    assert.match(list.sql, /o\.created_at <=/);
    assert.deepEqual(list.params, ['SHIPPING', '00000000-0000-4000-8000-000000000003', '%buyer@example.test%', '2026-10-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z', 11]);
    assert.equal(page.items[0]?.payments.length, 0);
    assert.equal(page.items[0]?.shipment, null);
  });

  it('rejects reversed date filters and non-Admin viewers', async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const service = new OrderQueryService(new InMemoryOrderRepository(), pool);
    await assert.rejects(() => service.listAdminOrdersPaginated({ request_id: 'req', user_id: 'buyer', role: 'BUYER' }, {}));
    await assert.rejects(() => service.listAdminOrdersPaginated({ request_id: 'req', user_id: 'admin', role: 'ADMIN' }, { from: '2026-10-03', to: '2026-10-01' }));
  });
});
