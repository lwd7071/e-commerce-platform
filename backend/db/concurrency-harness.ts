import type { Pool, PoolClient } from 'pg';
import type { Queryable } from './backup-restore.js';

export interface ConcurrencyRunnerOptions {
  concurrency: number;
  isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  barrierTimeoutMs?: number;
}

export interface WorkerExecutionResult<T> {
  workerIndex: number;
  success: boolean;
  data?: T;
  error?: Error & { code?: string; detail?: string };
  durationMs: number;
}

export interface ConcurrencyAggregateResult<T> {
  total: number;
  succeeded: number;
  failed: number;
  results: WorkerExecutionResult<T>[];
  errorCodesCount: Record<string, number>;
}

/**
 * Runner chạy N transaction đồng thời qua các kết nối PostgreSQL độc lập,
 * sử dụng Barrier Synchronization để kích hoạt tất cả transaction cùng lúc
 */
export async function runConcurrentTransactions<T>(
  pool: Pool,
  options: ConcurrencyRunnerOptions,
  task: (client: PoolClient, workerIndex: number) => Promise<T>,
): Promise<ConcurrencyAggregateResult<T>> {
  const { concurrency, isolationLevel = 'READ COMMITTED', barrierTimeoutMs = 15_000 } = options;

  if (concurrency < 1) {
    throw new Error('Concurrency must be at least 1');
  }

  // Thu thập N clients từ pool
  const clients: PoolClient[] = [];
  try {
    for (let i = 0; i < concurrency; i++) {
      const client = await pool.connect();
      clients.push(client);
    }
  } catch (err) {
    for (const c of clients) c.release();
    throw err;
  }

  // Barrier: tất cả client chờ tín hiệu đồng bộ trước khi thực thi
  let triggerStart!: () => void;
  const barrierPromise = new Promise<void>((resolve, reject) => {
    triggerStart = resolve;
    setTimeout(() => reject(new Error('Concurrency barrier timed out')), barrierTimeoutMs);
  });

  const workerPromises = clients.map(async (client, workerIndex): Promise<WorkerExecutionResult<T>> => {
    const startTime = Date.now();
    try {
      // Chờ barrier đồng bộ hóa
      await barrierPromise;

      await client.query(`BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`);

      const result = await task(client, workerIndex);

      await client.query('COMMIT');

      return {
        workerIndex,
        success: true,
        data: result,
        durationMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      await client.query('ROLLBACK').catch(() => {});
      const pgError = error as (Error & { code?: string; detail?: string });
      return {
        workerIndex,
        success: false,
        error: pgError,
        durationMs: Date.now() - startTime,
      };
    } finally {
      client.release();
    }
  });

  // Bật công tắc kích hoạt toàn bộ workers
  triggerStart();

  const results = await Promise.all(workerPromises);

  let succeeded = 0;
  let failed = 0;
  const errorCodesCount: Record<string, number> = {};

  for (const r of results) {
    if (r.success) {
      succeeded++;
    } else {
      failed++;
      const code = r.error?.code ?? 'UNKNOWN';
      errorCodesCount[code] = (errorCodesCount[code] ?? 0) + 1;
    }
  }

  return {
    total: concurrency,
    succeeded,
    failed,
    results,
    errorCodesCount,
  };
}

export interface PlanScanNode {
  nodeType: string;
  relationName?: string;
  indexName?: string;
}

export interface QueryPlanResult {
  rawPlan: string;
  totalCost?: number;
  scans: PlanScanNode[];
}

/**
 * Trích xuất execution plan của câu truy vấn PostgreSQL sử dụng EXPLAIN
 */
export async function explainQueryPlan(
  client: Queryable,
  query: string,
  params: unknown[] = [],
): Promise<QueryPlanResult> {
  const explainSql = `EXPLAIN (FORMAT JSON) ${query}`;
  const res = await client.query(explainSql, params);

  const rawJson = res.rows[0]?.['QUERY PLAN'] ?? res.rows[0];
  const planData = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;

  const rootPlan = (Array.isArray(planData) ? planData[0]?.Plan : planData?.Plan) as Record<string, unknown> | undefined;
  const scans: PlanScanNode[] = [];

  const traverse = (node: Record<string, unknown> | null | undefined) => {
    if (!node) return;
    if (typeof node['Node Type'] === 'string') {
      scans.push({
        nodeType: node['Node Type'] as string,
        relationName: node['Relation Name'] as string | undefined,
        indexName: node['Index Name'] as string | undefined,
      });
    }
    if (Array.isArray(node.Plans)) {
      for (const child of node.Plans) {
        traverse(child as Record<string, unknown>);
      }
    }
  };

  traverse(rootPlan);

  return {
    rawPlan: JSON.stringify(planData, null, 2),
    totalCost: rootPlan?.['Total Cost'],
    scans,
  };
}

/**
 * Xác nhận xem câu truy vấn có sử dụng index mong đợi hay không
 */
export function assertUsesIndex(planResult: QueryPlanResult, expectedIndexName: string): boolean {
  return planResult.scans.some(
    (scan) => scan.indexName?.toLowerCase() === expectedIndexName.toLowerCase(),
  );
}
