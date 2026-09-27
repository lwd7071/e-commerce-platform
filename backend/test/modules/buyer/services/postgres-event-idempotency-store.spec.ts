import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PostgresEventIdempotencyStore } from '../../../../src/modules/buyer/infrastructure/postgres-event-idempotency.store';
import type { IDbClient } from '../../../../src/modules/buyer/infrastructure/db-client';

class MockDbClient implements IDbClient {
  public queries: Array<{ sql: string; params?: unknown[] }> = [];
  public existingEventIds = new Set<string>();

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }> {
    this.queries.push({ sql, params });
    if (sql.includes('SELECT 1 FROM notifications WHERE event_id = $1')) {
      const eventId = params?.[0] as string;
      if (this.existingEventIds.has(eventId)) {
        return { rows: [{ '?column?': 1 } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }
}

describe('PostgresEventIdempotencyStore Unit / Contract Tests (T3 Phase 1)', () => {
  it('Fresh Event Claim: trả về true khi event_id chưa tồn tại trong notifications', async () => {
    const mockDb = new MockDbClient();
    const store = new PostgresEventIdempotencyStore(mockDb);

    const claimed = await store.tryClaim('evt-fresh-1');

    assert.equal(claimed, true);
    assert.equal(mockDb.queries.length, 1);
    assert.match(mockDb.queries[0].sql, /SELECT 1 FROM notifications WHERE event_id = \$1/);
    assert.deepEqual(mockDb.queries[0].params, ['evt-fresh-1']);
  });

  it('Duplicate Event Rejected: trả về false khi event_id đã tồn tại trong notifications', async () => {
    const mockDb = new MockDbClient();
    mockDb.existingEventIds.add('evt-duplicate-1');
    const store = new PostgresEventIdempotencyStore(mockDb);

    const claimed = await store.tryClaim('evt-duplicate-1');

    assert.equal(claimed, false);
    assert.equal(mockDb.queries.length, 1);
    assert.deepEqual(mockDb.queries[0].params, ['evt-duplicate-1']);
  });

  it('Crash / Transient Failure Resilience & Release No-op: release không ném lỗi, không xóa nhầm row và retry tryClaim vẫn trả true', async () => {
    const mockDb = new MockDbClient();
    const store = new PostgresEventIdempotencyStore(mockDb);

    // 1. Worker gọi tryClaim('evt-crash-1') thành công
    const firstClaim = await store.tryClaim('evt-crash-1');
    assert.equal(firstClaim, true);

    // 2. Worker bị crash / transient DB error trước khi commit INSERT notification
    //    Gọi release('evt-crash-1')
    await assert.doesNotReject(async () => {
      await store.release('evt-crash-1');
    });

    // 3. Xác nhận release() không có tác dụng phụ lên DB (không chạy DELETE hay thay đổi dữ liệu)
    const releaseQueries = mockDb.queries.filter(q => q.sql.includes('DELETE'));
    assert.equal(releaseQueries.length, 0);

    // 4. Khi retry / replay sau crash, do notification chưa được commit, tryClaim tiếp tục trả true
    const retryClaim = await store.tryClaim('evt-crash-1');
    assert.equal(retryClaim, true);
  });
});
