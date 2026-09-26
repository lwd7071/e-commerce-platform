import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.js';
import { closeDatabasePool, createDatabasePool } from '../../db/client.js';
import {
  runConcurrentTransactions,
  explainQueryPlan,
  assertUsesIndex,
} from '../../db/concurrency-harness.js';

const runRemoteDbTests = parseRunRemoteDbTests(process.env);
const remoteDescribe = runRemoteDbTests ? describe : describe.skip;

remoteDescribe('PostgreSQL Concurrency Harness & Query Plan Baseline (T3 Remote)', () => {
  let pool: Pool | undefined;

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    // Cấp pool tối đa 5 connections để chạy concurrency tests
    pool = createDatabasePool({ databaseUrl: config.directUrl, pool: { ...config.pool, max: 5 } });

    // Dọn dẹp probe cũ nếu có trong public
    await pool.query('DROP TABLE IF EXISTS public.p2_concurrency_probe CASCADE');

    // Tạo schema riêng biệt để cách ly tuyệt đối, không làm ô nhiễm information_schema của public
    await pool.query('CREATE SCHEMA IF NOT EXISTS p2_test_harness');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS p2_test_harness.concurrency_probe (
        probe_id UUID PRIMARY KEY,
        shared_key TEXT NOT NULL,
        worker_index INT NOT NULL
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_concurrency_probe__shared_key
      ON p2_test_harness.concurrency_probe(shared_key)
    `);
  }, 60_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA IF EXISTS p2_test_harness CASCADE');
      await closeDatabasePool(pool);
    }
  }, 20_000);

  describe('runConcurrentTransactions barrier execution', () => {
    it('executes 3 parallel non-conflicting transactions with 100% success', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const batchTag = `batch_${randomUUID().slice(0, 8)}`;

      const aggResult = await runConcurrentTransactions(
        pool,
        { concurrency: 3, isolationLevel: 'READ COMMITTED' },
        async (client, workerIndex) => {
          const probeId = randomUUID();
          await client.query(
            `INSERT INTO p2_test_harness.concurrency_probe (probe_id, shared_key, worker_index)
             VALUES ($1, $2, $3)`,
            [probeId, `${batchTag}_${workerIndex}`, workerIndex],
          );
          return { workerIndex, probeId };
        },
      );

      expect(aggResult.total).toBe(3);
      expect(aggResult.succeeded).toBe(3);
      expect(aggResult.failed).toBe(0);
      expect(Object.keys(aggResult.errorCodesCount)).toHaveLength(0);
    }, 35_000);

    it('detects and accurately categorizes concurrent unique race conditions (SQLSTATE 23505)', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const conflictKey = `race_${randomUUID().slice(0, 8)}`;

      // 3 workers cùng cố gắng chèn chung một conflictKey vào cột có UNIQUE constraint
      const aggResult = await runConcurrentTransactions(
        pool,
        { concurrency: 3, isolationLevel: 'READ COMMITTED' },
        async (client, workerIndex) => {
          const probeId = randomUUID();
          await client.query(
            `INSERT INTO p2_test_harness.concurrency_probe (probe_id, shared_key, worker_index)
             VALUES ($1, $2, $3)`,
            [probeId, conflictKey, workerIndex],
          );
          return { workerIndex };
        },
      );

      expect(aggResult.total).toBe(3);
      // Chính xác 1 worker ghi thành công
      expect(aggResult.succeeded).toBe(1);
      // 2 workers còn lại phải thất bại do va chạm UNIQUE
      expect(aggResult.failed).toBe(2);
      expect(aggResult.errorCodesCount['23505']).toBe(2);
    }, 35_000);

    it('supports REPEATABLE READ isolation level without leaking client connections', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const batchTag = `iso_${randomUUID().slice(0, 8)}`;

      const aggResult = await runConcurrentTransactions(
        pool,
        { concurrency: 2, isolationLevel: 'REPEATABLE READ' },
        async (client, workerIndex) => {
          const probeId = randomUUID();
          await client.query(
            `INSERT INTO p2_test_harness.concurrency_probe (probe_id, shared_key, worker_index)
             VALUES ($1, $2, $3)`,
            [probeId, `${batchTag}_${workerIndex}`, workerIndex],
          );
          return { probeId };
        },
      );

      expect(aggResult.succeeded).toBe(2);
      expect(aggResult.failed).toBe(0);
    }, 35_000);
  });

  describe('explainQueryPlan and assertUsesIndex', () => {
    it('extracts query plan and detects index usage for selective order queries', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const dummyBuyerId = '00000000-0000-0000-0000-000000000000';
      const plan = await explainQueryPlan(
        pool,
        'SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC',
        [dummyBuyerId],
      );

      expect(plan.rawPlan).toBeDefined();
      expect(typeof plan.totalCost).toBe('number');
      expect(plan.totalCost).toBeGreaterThan(0);
      expect(plan.scans.length).toBeGreaterThan(0);

      // Xác nhận có khả năng nhận biết index scan trên bảng orders
      const hasOrderScan = plan.scans.some((s) => s.relationName === 'orders');
      expect(hasOrderScan).toBe(true);
    }, 20_000);

    it('uses the expected Buyer and Transaction indexes for production query shapes', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // The acceptance database is intentionally small, so force index consideration
        // while preserving the exact predicates/order used by the repositories.
        await client.query('SET LOCAL enable_seqscan = off');
        const dummyId = '00000000-0000-0000-0000-000000000000';

        const notificationPlan = await explainQueryPlan(
          client,
          'SELECT * FROM notifications WHERE recipient_id = $1 AND is_read = $2 ORDER BY created_at DESC',
          [dummyId, false],
        );
        const orderPlan = await explainQueryPlan(
          client,
          'SELECT * FROM orders WHERE buyer_id = $1 ORDER BY created_at DESC',
          [dummyId],
        );
        const paymentPlan = await explainQueryPlan(
          client,
          'SELECT * FROM payments WHERE order_id = $1',
          [dummyId],
        );

        expect(assertUsesIndex(notificationPlan, 'idx_notifications__recipient_id__is_read__created_at')).toBe(true);
        expect(assertUsesIndex(orderPlan, 'idx_orders__buyer_id__created_at')).toBe(true);
        expect(assertUsesIndex(paymentPlan, 'idx_payments__order_id')).toBe(true);
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    }, 20_000);

    it('correctly reports true when expected index is used, and false otherwise', () => {
      const mockPlan = {
        rawPlan: '{}',
        totalCost: 10.5,
        scans: [
          { nodeType: 'Index Scan', relationName: 'vouchers', indexName: 'idx_vouchers__active_listing' },
        ],
      };

      expect(assertUsesIndex(mockPlan, 'idx_vouchers__active_listing')).toBe(true);
      expect(assertUsesIndex(mockPlan, 'idx_non_existent')).toBe(false);
    });
  });
});
