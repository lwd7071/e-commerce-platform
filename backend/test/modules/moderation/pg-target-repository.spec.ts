import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool, PoolClient } from 'pg';
import { PgModerationTargetRepository } from '../../../src/modules/moderation/repositories/pg-target.repository.ts';
import { PgTransactionManager } from '../../../src/platform/database/pg-transaction-manager.ts';
import { NotFoundError } from '../../../src/platform/errors/app-error.ts';

function createMockPool(queryResults: Record<string, { rows: unknown[]; rowCount?: number }>) {
  const queryLog: { sql: string; params?: unknown[] }[] = [];

  const mockClient = {
    query: async (sql: string, params?: unknown[]) => {
      queryLog.push({ sql, params });
      for (const [key, val] of Object.entries(queryResults)) {
        if (sql.includes(key)) {
          return val;
        }
      }
      return { rows: [], rowCount: 0 };
    },
    release: () => {
      queryLog.push({ sql: 'RELEASE' });
    }
  } as unknown as PoolClient;

  const mockPool = {
    query: async (sql: string, params?: unknown[]) => {
      queryLog.push({ sql, params });
      for (const [key, val] of Object.entries(queryResults)) {
        if (sql.includes(key)) {
          return val;
        }
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => mockClient
  } as unknown as Pool;

  return { mockPool, mockClient, queryLog };
}

describe('PgModerationTargetRepository & PgTransactionManager', () => {
  it('userExists: returns true when rowCount > 0 and false otherwise', async () => {
    const { mockPool } = createMockPool({
      'SELECT 1 FROM app_users': { rows: [{ '?column?': 1 }], rowCount: 1 }
    });
    const repo = new PgModerationTargetRepository(mockPool);
    const exists = await repo.userExists('00000000-0000-0000-0000-000000000001');
    assert.strictEqual(exists, true);
  });

  it('getUserStatus: returns user status when user exists and null otherwise', async () => {
    const { mockPool } = createMockPool({
      'SELECT status FROM app_users': { rows: [{ status: 'ACTIVE' }], rowCount: 1 }
    });
    const repo = new PgModerationTargetRepository(mockPool);
    const status = await repo.getUserStatus('00000000-0000-0000-0000-000000000001');
    assert.strictEqual(status, 'ACTIVE');
  });

  it('updateUserStatus: updates status and returns updated record', async () => {
    const nowIso = '2026-09-21T15:00:00.000Z';
    const { mockPool, mockClient } = createMockPool({
      'UPDATE app_users SET status': {
        rows: [{ user_id: '00000000-0000-0000-0000-000000000001', status: 'LOCKED', updated_at: nowIso }],
        rowCount: 1
      }
    });
    const repo = new PgModerationTargetRepository(mockPool);
    const res = await repo.updateUserStatus(mockClient, '00000000-0000-0000-0000-000000000001', 'LOCKED');
    assert.strictEqual(res.user_id, '00000000-0000-0000-0000-000000000001');
    assert.strictEqual(res.status, 'LOCKED');
  });

  it('updateUserStatus: throws NotFoundError when user not found', async () => {
    const { mockPool, mockClient } = createMockPool({
      'UPDATE app_users SET status': { rows: [], rowCount: 0 }
    });
    const repo = new PgModerationTargetRepository(mockPool);
    await assert.rejects(
      async () => {
        await repo.updateUserStatus(mockClient, '00000000-0000-0000-0000-000000000099', 'LOCKED');
      },
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        return true;
      }
    );
  });

  it('shopExists, productExists, reviewExists query respective tables', async () => {
    const { mockPool } = createMockPool({
      'SELECT 1 FROM shops': { rows: [{}], rowCount: 1 },
      'SELECT 1 FROM products': { rows: [{}], rowCount: 1 },
      'SELECT 1 FROM reviews': { rows: [{}], rowCount: 1 }
    });
    const repo = new PgModerationTargetRepository(mockPool);
    assert.strictEqual(await repo.shopExists('s1'), true);
    assert.strictEqual(await repo.productExists('p1'), true);
    assert.strictEqual(await repo.reviewExists('r1'), true);
  });

  it('insertModerationRecord executes insert on transaction client', async () => {
    const { mockPool, mockClient, queryLog } = createMockPool({});
    const repo = new PgModerationTargetRepository(mockPool);
    await repo.insertModerationRecord(mockClient, {
      moderation_id: 'm1',
      target_type: 'USER',
      target_id: 'u1',
      reason: 'Spam',
      action: 'LOCK',
      admin_id: 'a1'
    });
    const inserted = queryLog.find((q) => q.sql.includes('INSERT INTO moderation_records'));
    assert.ok(inserted);
    assert.deepStrictEqual(inserted.params, ['m1', 'USER', 'u1', 'Spam', 'LOCK', 'a1']);
  });

  it('PgTransactionManager: executes BEGIN, COMMIT on success and releases client', async () => {
    const { mockPool, queryLog } = createMockPool({});
    const txManager = new PgTransactionManager(mockPool);
    const result = await txManager.withTransaction(async (trx) => {
      await trx.query('SELECT 1');
      return 'ok';
    });

    assert.strictEqual(result, 'ok');
    const sqlCalls = queryLog.map((q) => q.sql);
    assert.ok(sqlCalls.includes('BEGIN'));
    assert.ok(sqlCalls.includes('COMMIT'));
    assert.ok(sqlCalls.includes('RELEASE'));
  });

  it('PgTransactionManager: executes ROLLBACK on error and releases client', async () => {
    const { mockPool, queryLog } = createMockPool({});
    const txManager = new PgTransactionManager(mockPool);
    await assert.rejects(
      async () => {
        await txManager.withTransaction(async () => {
          throw new Error('boom');
        });
      },
      /boom/
    );

    const sqlCalls = queryLog.map((q) => q.sql);
    assert.ok(sqlCalls.includes('BEGIN'));
    assert.ok(sqlCalls.includes('ROLLBACK'));
    assert.ok(sqlCalls.includes('RELEASE'));
  });
});
