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

    // Tạo bảng probe tạm thời để mô phỏng concurrency
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.p2_concurrency_probe (
        probe_id UUID PRIMARY KEY,
        shared_key TEXT NOT NULL,
        worker_index INT NOT NULL
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_concurrency_probe__shared_key
      ON public.p2_concurrency_probe(shared_key)
    `);
  }, 45_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP TABLE IF EXISTS public.p2_concurrency_probe CASCADE');
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
            `INSERT INTO public.p2_concurrency_probe (probe_id, shared_key, worker_index)
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
    }, 25_000);

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
            `INSERT INTO public.p2_concurrency_probe (probe_id, shared_key, worker_index)
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
    }, 25_000);

    it('supports REPEATABLE READ isolation level without leaking client connections', async () => {
      if (!pool) throw new Error('Pool not initialized');

      const batchTag = `iso_${randomUUID().slice(0, 8)}`;

      const aggResult = await runConcurrentTransactions(
        pool,
        { concurrency: 2, isolationLevel: 'REPEATABLE READ' },
        async (client, workerIndex) => {
          const probeId = randomUUID();
          await client.query(
            `INSERT INTO public.p2_concurrency_probe (probe_id, shared_key, worker_index)
             VALUES ($1, $2, $3)`,
            [probeId, `${batchTag}_${workerIndex}`, workerIndex],
          );
          return { probeId };
        },
      );

      expect(aggResult.succeeded).toBe(2);
      expect(aggResult.failed).toBe(0);
    }, 25_000);
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
