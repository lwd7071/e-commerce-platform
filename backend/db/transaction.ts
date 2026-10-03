import type { Pool, PoolClient } from 'pg';

export const TRANSACTION_ISOLATION_LEVELS = [
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
] as const;

export type TransactionIsolationLevel = typeof TRANSACTION_ISOLATION_LEVELS[number];

export type TransactionOptions = {
  isolationLevel?: TransactionIsolationLevel;
  readOnly?: boolean;
};

const isIsolationLevel = (value: unknown): value is TransactionIsolationLevel =>
  typeof value === 'string' && (TRANSACTION_ISOLATION_LEVELS as readonly string[]).includes(value);

const beginStatement = (options: TransactionOptions): string => {
  const isolationLevel = options.isolationLevel ?? 'READ COMMITTED';
  if (!isIsolationLevel(isolationLevel)) throw new TypeError('Unsupported isolation level');
  return `BEGIN ISOLATION LEVEL ${isolationLevel}${options.readOnly === true ? ' READ ONLY' : ''}`;
};

const transactionFailure = (operationError: unknown, rollbackError: unknown): AggregateError =>
  new AggregateError(
    [operationError, rollbackError],
    'Transaction operation failed and rollback also failed',
    { cause: operationError },
  );

export async function withTransaction<T>(
  pool: Pool,
  operation: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const begin = beginStatement(options);
  let client: PoolClient | undefined;

  try {
    client = await pool.connect();
    await client.query(begin);

    try {
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (operationError) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        throw transactionFailure(operationError, rollbackError);
      }
      throw operationError;
    }
  } finally {
    client?.release();
  }
}
