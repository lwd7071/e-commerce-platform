import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { seedExistingAuthUser } from '../../db/seed/existing-auth-user.js';

const seed = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: '  User@Example.COM ',
  role: 'BUYER' as const,
  status: 'ACTIVE' as const,
  fullName: '  Test User  ',
};

type FakeClient = { query: ReturnType<typeof vi.fn> };

const client = (): FakeClient => ({ query: vi.fn().mockResolvedValue({ rows: [] }) });

describe('seedExistingAuthUser', () => {
  it('normalizes input and does not update role/status on conflict', async () => {
    const fakeClient = client();
    await seedExistingAuthUser(fakeClient as unknown as PoolClient, seed);
    expect(fakeClient.query).toHaveBeenCalledTimes(2);
    const [userSql, userParams] = fakeClient.query.mock.calls[0];
    expect(userSql).toContain('ON CONFLICT (user_id) DO UPDATE');
    expect(userSql).toContain('email = EXCLUDED.email');
    expect(userSql).not.toContain('role = EXCLUDED.role');
    expect(userSql).not.toContain('status = EXCLUDED.status');
    expect(userParams).toEqual([seed.userId, 'user@example.com', 'BUYER', 'ACTIVE']);
    expect(fakeClient.query.mock.calls[1][1]).toEqual([seed.userId, 'Test User']);
  });

  it.each([
    ['empty fullName', { ...seed, fullName: '   ' }],
    ['empty email', { ...seed, email: '   ' }],
    ['invalid UUID', { ...seed, userId: 'not-a-uuid' }],
    ['invalid role', { ...seed, role: 'OWNER' as never }],
    ['invalid status', { ...seed, status: 'DISABLED' as never }],
  ])('rejects %s before SQL', async (_caseName, invalidSeed) => {
    const fakeClient = client();
    await expect(seedExistingAuthUser(fakeClient as unknown as PoolClient, invalidSeed)).rejects.toThrow();
    expect(fakeClient.query).not.toHaveBeenCalled();
  });

  it('propagates PostgreSQL constraint errors unchanged', async () => {
    const fakeClient = client();
    const databaseError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'uq_app_users__email',
    });
    fakeClient.query.mockRejectedValueOnce(databaseError);
    await expect(seedExistingAuthUser(fakeClient as unknown as PoolClient, seed)).rejects.toBe(databaseError);
  });

  it('propagates an email conflict from the second upsert unchanged', async () => {
    const fakeClient = client();
    const databaseError = Object.assign(new Error('duplicate email'), {
      code: '23505',
      constraint: 'uq_app_users__email',
    });
    fakeClient.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(databaseError);
    await expect(seedExistingAuthUser(fakeClient as unknown as PoolClient, seed)).rejects.toBe(databaseError);
    expect(fakeClient.query).toHaveBeenCalledTimes(2);
  });

  it('does not control the parent transaction', async () => {
    const fakeClient = client();
    await seedExistingAuthUser(fakeClient as unknown as PoolClient, seed);
    expect(fakeClient.query.mock.calls.map(([sql]) => sql)).not.toContain('BEGIN');
    expect(fakeClient.query.mock.calls.map(([sql]) => sql)).not.toContain('COMMIT');
    expect(fakeClient.query.mock.calls.map(([sql]) => sql)).not.toContain('ROLLBACK');
  });
});
