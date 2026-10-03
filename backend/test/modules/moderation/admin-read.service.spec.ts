import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { AdminReadService } from '../../../src/modules/moderation/services/admin-read.service.ts';
import { ValidationFailedError } from '../../../src/platform/errors/app-error.ts';

describe('Admin read endpoints', () => {
  it('calculates platform GMV from completed orders only (QD19)', async () => {
    let sql = '';
    const pool = { query: async (query: string) => { sql = query; return { rows: [{ total_users: '8', total_shops: '3', total_products: '12', platform_gmv: '1250.50' }] }; } } as unknown as Pool;
    const stats = await new AdminReadService(pool).getDashboardStats();
    assert.match(sql, /status='COMPLETED'/);
    assert.deepEqual(stats, { totalUsers: 8, totalShops: 3, totalProducts: 12, platformGMV: '1250.50' });
  });

  it('filters audit rows using bound values and a bounded limit', async () => {
    let params: unknown[] = [];
    const pool = { query: async (_sql: string, values: unknown[] = []) => { params = values; return { rows: [] }; } } as unknown as Pool;
    await new AdminReadService(pool).listAuditLogs({ action: 'ORDER_CANCELLED', target_type: 'ORDER', actor: 'admin-1', limit: 10 });
    assert.deepEqual(params, ['ORDER_CANCELLED', 'ORDER', 'admin-1', 10]);
    await assert.rejects(() => new AdminReadService(pool).listAuditLogs({ limit: 101 }), ValidationFailedError);
  });

  it('returns date-bounded operational report data using Ho Chi Minh local days and completed-order GMV', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const pool = { query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      if (/GROUP BY status/.test(sql)) return { rows: [{ status: 'COMPLETED', order_count: '2' }] };
      if (/AS local_day/.test(sql)) return { rows: [{ local_day: '2026-10-01', order_count: '2', gmv: '250.00' }] };
      if (/AS shop_name/.test(sql)) return { rows: [{ shop_name: 'Shop A', order_count: '2', gmv: '250.00' }] };
      if (/AS product_name/.test(sql)) return { rows: [{ product_name: 'Product A', quantity_sold: '3', gmv: '250.00' }] };
      return { rows: [{ action: 'HIDE', count: '1' }] };
    } } as unknown as Pool;

    const report = await new AdminReadService(pool).getOperationalReport({ from: '2026-10-01', to: '2026-10-02' });
    assert.equal(calls.length, 5);
    assert.equal(calls[0]?.values[0], '2026-10-01');
    assert.match(calls[1]?.sql ?? '', /AT TIME ZONE 'Asia\/Ho_Chi_Minh'/);
    assert.match(calls[1]?.sql ?? '', /status = 'COMPLETED'/);
    assert.deepEqual(report.dailyGmv, [{ date: '2026-10-01', orderCount: 2, gmv: '250.00' }]);
    assert.deepEqual(report.ordersByStatus, [{ status: 'COMPLETED', count: 2 }]);
    assert.equal(report.topShops[0]?.gmv, '250.00');
    assert.equal(report.topProducts[0]?.quantitySold, 3);
    assert.deepEqual(report.moderationActions, [{ action: 'HIDE', count: 1 }]);
  });

  it('rejects invalid or inverted reporting dates', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;
    const reads = new AdminReadService(pool);
    await assert.rejects(() => reads.getOperationalReport({ from: 'yesterday', to: '2026-10-02' }), ValidationFailedError);
    await assert.rejects(() => reads.getOperationalReport({ from: '2026-10-03', to: '2026-10-02' }), ValidationFailedError);
  });

  it('returns audit pages with a stable timestamp/id cursor and binds date filters', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const pool = { query: async (sql: string, values: unknown[] = []) => {
      calls.push({ sql, values });
      const first = { log_id: '00000000-0000-4000-8000-000000000001', action: 'HIDE_PRODUCT', target_type: 'PRODUCT', target_id: '00000000-0000-4000-8000-000000000002', reason: 'Policy', created_at: new Date('2026-10-01T10:00:00Z'), actor: 'admin@example.test' };
      const second = { ...first, log_id: '00000000-0000-4000-8000-000000000003' };
      return { rows: calls.length === 1 ? [first, second] : [first] };
    } } as unknown as Pool;
    const reads = new AdminReadService(pool);
    const page = await reads.listAuditLogsPage({ from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z', limit: 1 });
    assert.equal(page.has_more, true);
    assert.equal(page.items.length, 1);
    assert.equal(calls[0]?.values[0], '2026-10-01T00:00:00Z');
    assert.match(calls[0]?.sql ?? '', /created_at DESC, l\.log_id ASC/);
    const cursor = page.next_cursor;
    await reads.listAuditLogsPage({ limit: 1, cursor: cursor ?? undefined });
    assert.match(calls[1]?.sql ?? '', /l\.created_at < \$\d+::timestamptz/);
  });

  it('rejects malformed audit cursors', async () => {
    const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;
    await assert.rejects(() => new AdminReadService(pool).listAuditLogsPage({ cursor: 'bad-cursor' }), ValidationFailedError);
  });
});
