import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolConstructor = vi.fn();

vi.mock('pg', () => ({
  default: { Pool: poolConstructor },
}));

describe('database pool factory', () => {
  beforeEach(() => {
    poolConstructor.mockReset();
  });

  it('does not construct a pool while importing the module', async () => {
    vi.resetModules();
    await import('../../db/client.js');
    expect(poolConstructor).not.toHaveBeenCalled();
  });

  it('constructs lazily with the runtime URL and bounded pool settings', async () => {
    const fakePool = { end: vi.fn() };
    poolConstructor.mockReturnValue(fakePool);
    vi.resetModules();
    const { createDatabasePool, closeDatabasePool } = await import('../../db/client.js');
    const pool = createDatabasePool({
      databaseUrl: new URL('postgresql://runtime.example.test/db'),
      pool: { max: 4, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 30_000 },
    });
    expect(pool).toBe(fakePool);
    expect(poolConstructor).toHaveBeenCalledWith({
      connectionString: 'postgresql://runtime.example.test/db',
      max: 4,
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 30_000,
    });
    await closeDatabasePool(pool);
    expect(fakePool.end).toHaveBeenCalledOnce();
  });
});
