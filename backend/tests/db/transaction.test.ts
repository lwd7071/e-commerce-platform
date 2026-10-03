import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { withTransaction } from '../../db/transaction.js';

type FakeClient = {
  query: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};

const fakeClient = (): FakeClient => ({ query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() });
const fakePool = (client: FakeClient): Pool =>
  ({ connect: vi.fn().mockResolvedValue(client) }) as unknown as Pool;

describe('withTransaction', () => {
  it('commits and releases after a successful operation', async () => {
    const client = fakeClient();
    await expect(withTransaction(fakePool(client), async () => 'ok')).resolves.toBe('ok');
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN ISOLATION LEVEL READ COMMITTED', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back and preserves the operation error', async () => {
    const client = fakeClient();
    const operationError = new Error('operation failed');
    await expect(withTransaction(fakePool(client), async () => { throw operationError; })).rejects.toBe(operationError);
    expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN ISOLATION LEVEL READ COMMITTED', 'ROLLBACK']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('returns an AggregateError with cause when operation and rollback both fail', async () => {
    const client = fakeClient();
    const operationError = new Error('operation failed');
    const rollbackError = new Error('rollback failed');
    client.query.mockImplementation(async (sql: string) => {
      if (sql === 'ROLLBACK') throw rollbackError;
      return { rows: [] };
    });
    await expect(withTransaction(fakePool(client), async () => { throw operationError; })).rejects.toSatisfy((error: unknown) =>
      error instanceof AggregateError
      && error.cause === operationError
      && error.errors[0] === operationError
      && error.errors[1] === rollbackError,
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not release an undefined client when pool.connect fails', async () => {
    const pool = { connect: vi.fn().mockRejectedValue(new Error('pool exhausted')) } as unknown as Pool;
    await expect(withTransaction(pool, async () => undefined)).rejects.toThrow('pool exhausted');
  });

  it('rejects isolation injection before connecting', async () => {
    const pool = { connect: vi.fn() } as unknown as Pool;
    await expect(withTransaction(pool, async () => undefined, { isolationLevel: 'SERIALIZABLE; DROP TABLE users' as never }))
      .rejects.toThrow('Unsupported isolation level');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('preserves serializable/deadlock error codes without retrying', async () => {
    const client = fakeClient();
    const serializationError = Object.assign(new Error('serialization failure'), { code: '40001' });
    await expect(withTransaction(fakePool(client), async () => { throw serializationError; })).rejects.toBe(serializationError);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('emits the requested isolation and read-only mode', async () => {
    const client = fakeClient();
    await withTransaction(fakePool(client), async () => undefined, { isolationLevel: 'SERIALIZABLE', readOnly: true });
    expect(client.query).toHaveBeenCalledWith('BEGIN ISOLATION LEVEL SERIALIZABLE READ ONLY');
  });
});
