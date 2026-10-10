import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { AdminVoucherService } from '../../../src/modules/voucher/services/admin-voucher.service.ts';
import { ReasonRequiredError } from '../../../src/platform/errors/app-error.ts';

const voucherRow = {
  voucher_id: 'v-1', code: 'PLATFORM10', voucher_name: 'Platform sale', scope: 'PLATFORM', shop_id: null,
  discount_type: 'PERCENT', discount_value: '10.00', max_discount: '50000.00', min_order_value: '100000.00',
  quantity: 100, start_at: new Date('2026-10-01T00:00:00Z'), end_at: new Date('2026-10-31T00:00:00Z'),
  status: 'ACTIVE', created_at: new Date('2026-10-01T00:00:00Z'), updated_at: new Date('2026-10-01T00:00:00Z'),
};

function poolFor(queries: Array<{ sql: string; params: unknown[] }>): Pool {
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params });
      if (sql.includes('INSERT INTO vouchers')) return { rows: [voucherRow], rowCount: 1 };
      if (sql.includes('SELECT 1 FROM voucher_usages')) return { rows: [], rowCount: 0 };
      if (sql.includes('SELECT quantity FROM vouchers')) return { rows: [{ quantity: 100 }], rowCount: 1 };
      if (sql.includes('SELECT voucher_id')) return { rows: [voucherRow], rowCount: 1 };
      if (sql.includes('UPDATE vouchers')) return { rows: [{ ...voucherRow, status: params[0] }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }, release() {},
  };
  return { connect: async () => client } as unknown as Pool;
}

describe('Admin PLATFORM vouchers', () => {
  it('requires a reason and creates PLATFORM scope with a null shop in one transaction', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const service = new AdminVoucherService(poolFor(queries));
    const input = { code: ' platform10 ', voucher_name: 'Platform sale', discount_type: 'PERCENT', discount_value: '10.00', max_discount: '50000.00', min_order_value: '100000.00', quantity: 100, start_at: '2026-10-01T00:00:00Z', end_at: '2026-10-31T00:00:00Z' };
    await assert.rejects(() => service.create('admin-1', input), ReasonRequiredError);
    const created = await service.create('admin-1', { ...input, reason: 'Approved campaign' });
    const insert = queries.find(query => query.sql.includes('INSERT INTO vouchers'));
    assert.match(insert?.sql ?? '', /'PLATFORM',NULL/);
    assert.equal(created.scope, 'PLATFORM');
    assert.equal(created.shop_id, null);
    assert.ok(queries.some(query => query.sql.includes('INSERT INTO admin_logs')));
    assert.ok(queries.some(query => query.sql === 'COMMIT'));
  });

  it('restricts status changes to existing PLATFORM vouchers and audits the mutation', async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const result = await new AdminVoucherService(poolFor(queries)).setStatus('admin-1', 'v-1', 'INACTIVE', 'Campaign ended');
    assert.equal(result.status, 'INACTIVE');
    const update = queries.find(query => query.sql.includes('UPDATE vouchers'));
    assert.match(update?.sql ?? '', /scope='PLATFORM' AND shop_id IS NULL/);
    assert.ok(queries.some(query => query.sql.includes('INSERT INTO admin_logs')));
  });
});
