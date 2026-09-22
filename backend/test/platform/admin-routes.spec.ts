import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { ModerationService } from '../../src/modules/moderation/services/moderation.service.ts';
import type { ITargetLookupRepository, IAuditPort, ITransactionManager, UserStatus, ModerationRecord } from '../../src/modules/moderation/domain/moderation.types.ts';
import type { IAuthRepository } from '../../src/modules/identity/repositories/auth.repository.ts';
import type { AuthUserRecord } from '../../src/modules/identity/domain/types.ts';
import { createAuthMiddleware, StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';

class InMemoryAuthAndTargetRepository implements ITargetLookupRepository, IAuthRepository {
  public users = new Map<string, { id: string; email: string; role: 'BUYER' | 'SELLER' | 'ADMIN'; status: UserStatus; updated_at: string }>();
  public shops = new Set<string>();
  public products = new Set<string>();
  public reviews = new Set<string>();
  public moderationRecords: ModerationRecord[] = [];

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const u = this.users.get(userId);
    return u ? u.status : null;
  }

  async updateUserStatus(_trx: unknown, userId: string, status: UserStatus): Promise<{ user_id: string; status: UserStatus; updated_at: string }> {
    const u = this.users.get(userId);
    if (!u) throw new Error('User not found');
    u.status = status;
    u.updated_at = new Date().toISOString();
    return { user_id: u.id, status: u.status, updated_at: u.updated_at };
  }

  async shopExists(shopId: string): Promise<boolean> {
    return this.shops.has(shopId);
  }

  async productExists(productId: string): Promise<boolean> {
    return this.products.has(productId);
  }

  async reviewExists(reviewId: string): Promise<boolean> {
    return this.reviews.has(reviewId);
  }

  async insertModerationRecord(_trx: unknown, record: ModerationRecord): Promise<void> {
    this.moderationRecords.push(record);
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(id);
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };
  }

  async findShopByOwnerId(_ownerId: string): Promise<string | null> {
    return null;
  }
}

class FakeAuditPort implements IAuditPort {
  public logs: unknown[] = [];
  async logAdminAction(record: unknown): Promise<void> {
    this.logs.push(record);
  }
}

class NoopTransactionManager implements ITransactionManager {
  async withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T> {
    return fn({});
  }
}

describe('Phase 4 — Admin Lock & Unlock Endpoints (TDD Cycle 4.1 & 4.2)', () => {
  let repo: InMemoryAuthAndTargetRepository;
  let auditPort: FakeAuditPort;
  let txManager: NoopTransactionManager;
  let moderationService: ModerationService;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;

  const adminId = '11111111-1111-4111-8111-111111111111';
  const buyerId = '22222222-2222-4222-8222-222222222222';
  const targetUserId = '33333333-3333-4333-8333-333333333333';
  const lockedUserId = '44444444-4444-4444-8444-444444444444';

  beforeEach(() => {
    repo = new InMemoryAuthAndTargetRepository();
    repo.users.set(adminId, { id: adminId, email: 'admin@platform.com', role: 'ADMIN', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(buyerId, { id: buyerId, email: 'buyer@platform.com', role: 'BUYER', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(targetUserId, { id: targetUserId, email: 'target@platform.com', role: 'BUYER', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(lockedUserId, { id: lockedUserId, email: 'locked@platform.com', role: 'BUYER', status: 'LOCKED', updated_at: '2026-01-01T00:00:00.000Z' });

    auditPort = new FakeAuditPort();
    txManager = new NoopTransactionManager();
    moderationService = new ModerationService(repo, auditPort, txManager);
    authMiddleware = createAuthMiddleware(repo, new StubTokenVerifier());
  });

  describe('Cycle 4.1: POST /api/v1/admin/users/:id/lock', () => {
    it('Case 1: rejects unauthenticated request with 401 AUTH_REQUIRED', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/lock`)
        .send({ reason: 'Spamming' })
        .expect(401);

      assert.strictEqual(res.body.error.code, 'AUTH_REQUIRED');
    });

    it('Case 2: rejects BUYER role with 403 RESOURCE_FORBIDDEN', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer stub-token-${buyerId}`)
        .send({ reason: 'Spamming' })
        .expect(403);

      assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
    });

    it('Case 3: rejects missing or whitespace reason with 422 REASON_REQUIRED (QD17)', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: '   ' })
        .expect(422);

      assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
    });

    it('Case 4: rejects non-existent user with 404 RESOURCE_NOT_FOUND (RB-KN20)', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post('/api/v1/admin/users/99999999-9999-4999-8999-999999999999/lock')
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Violating terms' })
        .expect(404);

      assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
    });

    it('Case 5: rejects locking already LOCKED user with 409 USER_ALREADY_LOCKED', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${lockedUserId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Another violation' })
        .expect(409);

      assert.strictEqual(res.body.error.code, 'USER_ALREADY_LOCKED');
    });

    it('Case 6: successfully locks ACTIVE user, returns 200 with standard envelope', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Violating terms of service' })
        .expect(200);

      assert.strictEqual(res.body.data.user_id, targetUserId);
      assert.strictEqual(res.body.data.status, 'LOCKED');
      assert.ok(typeof res.body.data.updated_at === 'string');
      assert.ok(typeof res.body.request_id === 'string');

      // Verify repo updated
      assert.strictEqual(repo.users.get(targetUserId)?.status, 'LOCKED');
      // Verify audit logged
      assert.strictEqual(auditPort.logs.length, 1);
    });

    it('Case 7 (QD03 Enforcement): newly locked user is immediately rejected with 403 USER_LOCKED on protected routes', async () => {
      const app = createApp({
        auth: authMiddleware,
        moderation: moderationService,
        buyer: {
          async listAddresses() { return []; },
          async createAddress() { return {}; },
          async getCart() { return {}; },
          async addCartItem() { return {}; },
          async updateCartItem() { return {}; },
          async deleteCartItem() {},
          async applicableVouchers() { return []; },
          async evaluateVoucher() { return {}; },
        }
      });

      // 1. Admin locks targetUserId
      await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Fraudulent activity' })
        .expect(200);

      // 2. targetUserId attempts to access buyer protected route with valid token
      const protectedRes = await request(app)
        .get('/api/v1/addresses')
        .set('Authorization', `Bearer stub-token-${targetUserId}`)
        .expect(403);

      assert.strictEqual(protectedRes.body.error.code, 'USER_LOCKED');
    });
  });

  describe('Cycle 4.2: POST /api/v1/admin/users/:id/unlock', () => {
    it('Case 1: rejects BUYER role with 403 RESOURCE_FORBIDDEN', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${lockedUserId}/unlock`)
        .set('Authorization', `Bearer stub-token-${buyerId}`)
        .send({ reason: 'Appeal approved' })
        .expect(403);

      assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
    });

    it('Case 2: rejects missing or whitespace reason with 422 REASON_REQUIRED (QD17)', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${lockedUserId}/unlock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: '' })
        .expect(422);

      assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
    });

    it('Case 3: rejects non-existent user with 404 RESOURCE_NOT_FOUND (RB-KN20)', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post('/api/v1/admin/users/99999999-9999-4999-8999-999999999999/unlock')
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Appeal approved' })
        .expect(404);

      assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
    });

    it('Case 4: rejects unlocking already ACTIVE user with 409 USER_ALREADY_ACTIVE', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${targetUserId}/unlock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Appeal approved' })
        .expect(409);

      assert.strictEqual(res.body.error.code, 'USER_ALREADY_ACTIVE');
    });

    it('Case 5: successfully unlocks LOCKED user, returns 200 with standard envelope', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${lockedUserId}/unlock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Account appeal approved after verification' })
        .expect(200);

      assert.strictEqual(res.body.data.user_id, lockedUserId);
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.ok(typeof res.body.data.updated_at === 'string');
      assert.ok(typeof res.body.request_id === 'string');

      // Verify repo updated
      assert.strictEqual(repo.users.get(lockedUserId)?.status, 'ACTIVE');
      // Verify audit logged
      assert.strictEqual(auditPort.logs.length, 1);
    });
  });
});
