import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PgAuthRepository } from '../../src/modules/identity/repositories/pg-auth.repository.ts';

describe('PgAuthRepository', () => {
  it('returns existing user from app_users without checking auth.users', async () => {
    let bootstrapCalled = false;
    const fakeDb = {
      async query(sql: string, params: unknown[]) {
        if (sql.includes('FROM app_users')) {
          assert.equal(params[0], 'u-123');
          return { rows: [{ id: 'u-123', email: 'user@test.com', role: 'BUYER', status: 'ACTIVE' }] };
        }
        if (sql.includes('INSERT INTO app_users')) {
          bootstrapCalled = true;
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    const repo = new PgAuthRepository(fakeDb as unknown as ConstructorParameters<typeof PgAuthRepository>[0]);
    const user = await repo.findUserById('u-123');
    assert.equal(user?.id, 'u-123');
    assert.equal(user?.email, 'user@test.com');
    assert.equal(bootstrapCalled, false);
  });

  it('self-heals and bootstraps user from auth.users if missing from app_users', async () => {
    let queryCount = 0;
    const fakeDb = {
      async query(sql: string, params: unknown[]) {
        queryCount++;
        if (sql.includes('FROM app_users WHERE user_id')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO app_users')) {
          assert.equal(params[0], 'google-u-456');
          return {
            rows: [{ id: 'google-u-456', email: 'google@test.com', role: 'BUYER', status: 'ACTIVE' }],
          };
        }
        return { rows: [] };
      },
    };

    const repo = new PgAuthRepository(fakeDb as unknown as ConstructorParameters<typeof PgAuthRepository>[0]);
    const user = await repo.findUserById('google-u-456');
    assert.equal(user?.id, 'google-u-456');
    assert.equal(user?.email, 'google@test.com');
    assert.equal(queryCount, 2);
  });

  it('returns null if user does not exist in app_users or auth.users', async () => {
    const fakeDb = {
      async query() {
        return { rows: [] };
      },
    };

    const repo = new PgAuthRepository(fakeDb as unknown as ConstructorParameters<typeof PgAuthRepository>[0]);
    const user = await repo.findUserById('non-existent');
    assert.equal(user, null);
  });
});
