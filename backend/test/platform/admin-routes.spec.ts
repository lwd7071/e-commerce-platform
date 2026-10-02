import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { ModerationService } from '../../src/modules/moderation/services/moderation.service.ts';
import type { ITargetLookupRepository, IAuditPort, ITransactionManager, UserStatus, ModerationRecord } from '../../src/modules/moderation/domain/moderation.types.ts';
import type { IAuthRepository } from '../../src/modules/identity/repositories/auth.repository.ts';
import type { AuthUserRecord } from '../../src/modules/identity/domain/types.ts';
import { createAuthMiddleware, StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import { OrderQueryService } from '../../src/modules/order/services/order-query.service.ts';
import { InMemoryOrderRepository } from '../../src/modules/order/repositories/in-memory-order.repository.ts';
import type { Pool } from 'pg';

class InMemoryAuthAndTargetRepository implements ITargetLookupRepository, IAuthRepository {
  public users = new Map<string, { id: string; email: string; role: 'BUYER' | 'SELLER' | 'ADMIN'; status: UserStatus; updated_at: string }>();
  public shops = new Set<string>();
  public shopsMap = new Map<string, { shop_id: string; shop_name: string; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED'; owner_id: string; product_count: number }>();
  public products = new Set<string>();
  public productStatuses = new Map<string, 'ACTIVE' | 'HIDDEN'>();
  public reviews = new Set<string>();
  public moderationRecords: ModerationRecord[] = [];

  async userExists(userId: string): Promise<boolean> {
    return this.users.has(userId);
  }

  async getUserStatus(userId: string): Promise<UserStatus | null> {
    const u = this.users.get(userId);
    return u ? u.status : null;
  }

  async getUserRole(userId: string): Promise<'BUYER' | 'SELLER' | 'ADMIN' | null> {
    const u = this.users.get(userId);
    return u ? u.role : null;
  }

  async updateUserStatus(_trx: unknown, userId: string, status: UserStatus): Promise<{ user_id: string; status: UserStatus; updated_at: string }> {
    const u = this.users.get(userId);
    if (!u) throw new Error('User not found');
    u.status = status;
    u.updated_at = new Date().toISOString();
    return { user_id: u.id, status: u.status, updated_at: u.updated_at };
  }

  async shopExists(shopId: string): Promise<boolean> {
    return this.shopsMap.has(shopId) || this.shops.has(shopId);
  }

  async hasRequiredShopProfile(): Promise<boolean> { return true; }

  async getShopStatus(shopId: string): Promise<'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | null> {
    const s = this.shopsMap.get(shopId);
    return s ? s.status : null;
  }

  async updateShopStatus(_trx: unknown, shopId: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED'): Promise<{ shop_id: string; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED'; updated_at: string }> {
    const s = this.shopsMap.get(shopId);
    if (!s) throw new Error('Shop not found');
    s.status = status;
    return { shop_id: s.shop_id, status: s.status, updated_at: new Date().toISOString() };
  }

  async listShops(params?: { status?: string; search?: string }) {
    let list = Array.from(this.shopsMap.values()).map(s => ({
      ...s,
      description: null,
      logo_url: null,
      pickup_address: null,
      contact_phone: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    if (params?.status && params.status !== 'ALL') {
      list = list.filter(s => s.status === params.status);
    }
    if (params?.search) {
      list = list.filter(s => s.shop_name.includes(params.search!));
    }
    return list;
  }

  async listUsers(params?: { role?: string; status?: string; search?: string }) {
    let list = Array.from(this.users.values()).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.email.split('@')[0],
      role: u.role,
      status: u.status,
      created_at: u.updated_at,
      updated_at: u.updated_at,
    }));
    if (params?.role && params.role !== 'ALL') {
      list = list.filter(u => u.role === params.role);
    }
    if (params?.status && params.status !== 'ALL') {
      list = list.filter(u => u.status === params.status);
    }
    return list;
  }

  async productExists(productId: string): Promise<boolean> {
    return this.products.has(productId);
  }

  async getProductStatus(productId: string): Promise<'ACTIVE' | 'HIDDEN' | null> {
    return this.productStatuses.get(productId) ?? null;
  }

  async updateProductStatus(_trx: unknown, productId: string, status: 'ACTIVE' | 'HIDDEN') {
    this.productStatuses.set(productId, status);
    return { product_id: productId, status, updated_at: new Date().toISOString() };
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
  const pendingShopId = '55555555-5555-5555-8555-555555555555';
  const activeShopId = '66666666-6666-6666-8666-666666666666';
  const lockedShopId = '77777777-7777-7777-8777-777777777777';

  beforeEach(() => {
    repo = new InMemoryAuthAndTargetRepository();
    repo.users.set(adminId, { id: adminId, email: 'admin@platform.com', role: 'ADMIN', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(buyerId, { id: buyerId, email: 'buyer@platform.com', role: 'BUYER', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(targetUserId, { id: targetUserId, email: 'target@platform.com', role: 'BUYER', status: 'ACTIVE', updated_at: '2026-01-01T00:00:00.000Z' });
    repo.users.set(lockedUserId, { id: lockedUserId, email: 'locked@platform.com', role: 'BUYER', status: 'LOCKED', updated_at: '2026-01-01T00:00:00.000Z' });

    repo.shopsMap.set(pendingShopId, { shop_id: pendingShopId, shop_name: 'Dino Demo Shop 01', status: 'PENDING', owner_id: buyerId, product_count: 5 });
    repo.shopsMap.set(activeShopId, { shop_id: activeShopId, shop_name: 'Active Shop', status: 'ACTIVE', owner_id: targetUserId, product_count: 10 });
    repo.shopsMap.set(lockedShopId, { shop_id: lockedShopId, shop_name: 'Locked Shop', status: 'LOCKED', owner_id: lockedUserId, product_count: 0 });
    repo.products.add('88888888-8888-4888-8888-888888888888');
    repo.productStatuses.set('88888888-8888-4888-8888-888888888888', 'ACTIVE');

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
          async clearSelectedCartItems() {},
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

    it('Case 8 (C-402 ADMIN_TARGET_PROTECTED): rejects locking an ADMIN user with 403 ADMIN_TARGET_PROTECTED', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/users/${adminId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Attempt to lock admin' })
        .expect(403);

      assert.strictEqual(res.body.error.code, 'ADMIN_TARGET_PROTECTED');
    });
  });

  it('hides a product through an ADMIN-only command and returns the changed state', async () => {
    const productId = '88888888-8888-4888-8888-888888888888';
    const app = createApp({ auth: authMiddleware, moderation: moderationService });
    const res = await request(app)
      .patch(`/api/v1/admin/products/${productId}/moderate`)
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .send({ status: 'HIDDEN', reason: 'Nội dung vi phạm quy định' })
      .expect(200);

    assert.equal(repo.productStatuses.get(productId), 'HIDDEN');
    assert.equal(res.body.data.status, 'HIDDEN');
    assert.equal(res.body.data.product_id, productId);
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

  describe('Cycle 4.3: GET /api/v1/admin/shops & POST /api/v1/admin/shops/:id/approve', () => {
    it('Case 1: rejects non-admin accessing /admin/shops with 403 RESOURCE_FORBIDDEN', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .get('/api/v1/admin/shops')
        .set('Authorization', `Bearer stub-token-${buyerId}`)
        .expect(403);

      assert.strictEqual(res.body.error.code, 'RESOURCE_FORBIDDEN');
    });

    it('Case 2: returns full shops list and filters by status=PENDING', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const resAll = await request(app)
        .get('/api/v1/admin/shops')
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .expect(200);

      assert.strictEqual(resAll.body.data.length, 3);

      const resPending = await request(app)
        .get('/api/v1/admin/shops?status=PENDING')
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .expect(200);

      assert.strictEqual(resPending.body.data.length, 1);
      assert.strictEqual(resPending.body.data[0].shop_id, pendingShopId);
      assert.strictEqual(resPending.body.data[0].status, 'PENDING');
    });

    it('Case 3: approves PENDING shop to ACTIVE successfully', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/shops/${pendingShopId}/approve`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Documents verified and approved' })
        .expect(200);

      assert.strictEqual(res.body.data.shop_id, pendingShopId);
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.strictEqual(repo.shopsMap.get(pendingShopId)?.status, 'ACTIVE');
    });

    it('Case 4: rejects approving already ACTIVE shop with 409 SHOP_ALREADY_ACTIVE', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/shops/${activeShopId}/approve`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Re-approval attempt' })
        .expect(409);

      assert.strictEqual(res.body.error.code, 'SHOP_ALREADY_ACTIVE');
    });
  });

  describe('Cycle 4.4: POST /api/v1/admin/shops/:id/lock & unlock', () => {
    it('Case 1: rejects locking shop when reason is missing with 422 REASON_REQUIRED', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/shops/${activeShopId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: '' })
        .expect(422);

      assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
    });

    it('Case 2: successfully locks ACTIVE shop to LOCKED', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/shops/${activeShopId}/lock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Selling prohibited items' })
        .expect(200);

      assert.strictEqual(res.body.data.shop_id, activeShopId);
      assert.strictEqual(res.body.data.status, 'LOCKED');
      assert.strictEqual(repo.shopsMap.get(activeShopId)?.status, 'LOCKED');
    });

    it('Case 3: successfully unlocks LOCKED shop to ACTIVE', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .post(`/api/v1/admin/shops/${lockedShopId}/unlock`)
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .send({ reason: 'Store verified compliance' })
        .expect(200);

      assert.strictEqual(res.body.data.shop_id, lockedShopId);
      assert.strictEqual(res.body.data.status, 'ACTIVE');
      assert.strictEqual(repo.shopsMap.get(lockedShopId)?.status, 'ACTIVE');
    });
  });

  describe('Cycle 4.5: GET /api/v1/admin/users', () => {
    it('Case 1: returns list of users for admin', async () => {
      const app = createApp({ auth: authMiddleware, moderation: moderationService });
      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer stub-token-${adminId}`)
        .expect(200);

      assert.ok(Array.isArray(res.body.data));
      assert.strictEqual(res.body.data.length, 4);
      assert.ok(res.body.data.some((u: { role: string }) => u.role === 'ADMIN'));
      assert.ok(res.body.data.some((u: { role: string }) => u.role === 'BUYER'));
    });
  });

  describe('Admin order routes', () => {
    it('serves cursor metadata and requires a reason for state-machine intervention', async () => {
      const pool = { query: async (sql: string) => {
        if (sql.includes('SELECT o.order_id')) return { rows: [{ order_id: '00000000-0000-4000-8000-000000000001', buyer_id: buyerId, buyer_email: 'buyer@platform.com', shop_id: pendingShopId, shop_name: 'Dino Demo Shop 01', status: 'SHIPPING', subtotal: '100.00', discount_amount: '0.00', shipping_fee: '0.00', total_amount: '100.00', cancel_reason: null, created_at: new Date('2026-10-02T00:00:00Z'), updated_at: new Date('2026-10-02T00:00:00Z') }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      } } as unknown as Pool;
      let transitionReason = '';
      const app = createApp({
        auth: authMiddleware,
        orderServices: {
          orderQueryService: new OrderQueryService(new InMemoryOrderRepository(), pool),
          transitionOrder: async (_ctx, _id, input) => { transitionReason = String(input.reason); return { status: input.to }; },
        },
      });
      const list = await request(app).get('/api/v1/admin/orders?search=buyer%40platform.com').set('Authorization', `Bearer stub-token-${adminId}`).expect(200);
      assert.equal(list.body.data.length, 1);
      assert.equal(list.body.data[0].payments.length, 0);
      assert.equal(list.body.meta.has_more, false);

      await request(app).patch('/api/v1/admin/orders/00000000-0000-4000-8000-000000000001/transition')
        .set('Authorization', `Bearer stub-token-${adminId}`).send({ to: 'COMPLETED', reason: ' ' }).expect(422);
      const result = await request(app).patch('/api/v1/admin/orders/00000000-0000-4000-8000-000000000001/transition')
        .set('Authorization', `Bearer stub-token-${adminId}`).send({ to: 'COMPLETED', reason: 'Delivery proof reviewed' }).expect(200);
      assert.equal(transitionReason, 'Delivery proof reviewed');
      assert.equal(result.body.data.status, 'COMPLETED');
    });
  });

  describe('Admin reporting routes', () => {
    it('serves reports to Admin and denies Buyer access', async () => {
      const pool = { query: async (sql: string) => {
        if (sql.includes('GROUP BY status')) return { rows: [{ status: 'COMPLETED', order_count: '1' }] };
        if (sql.includes('AS local_day')) return { rows: [{ local_day: '2026-10-01', order_count: '1', gmv: '100.00' }] };
        if (sql.includes('AS shop_name')) return { rows: [] };
        if (sql.includes('AS product_name')) return { rows: [] };
        return { rows: [] };
      } } as unknown as Pool;
      const app = createApp({ auth: authMiddleware, pool });
      const result = await request(app).get('/api/v1/admin/reports?from=2026-10-01&to=2026-10-02')
        .set('Authorization', `Bearer stub-token-${adminId}`).expect(200);
      assert.equal(result.body.data.dailyGmv[0].gmv, '100.00');
      await request(app).get('/api/v1/admin/reports?from=2026-10-01&to=2026-10-02')
        .set('Authorization', `Bearer stub-token-${buyerId}`).expect(403);
    });
  });
});
