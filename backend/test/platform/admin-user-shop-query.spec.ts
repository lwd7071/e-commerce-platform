import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../src/platform/http/app.ts';
import { createAuthMiddleware, StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import type { ITargetLookupRepository, UserStatus, AdminShopItem, AdminUserItem, IModerationService } from '../../src/modules/moderation/domain/moderation.types.ts';
import type { IAuthRepository } from '../../src/modules/identity/repositories/auth.repository.ts';

class MockUserShopRepository implements ITargetLookupRepository, IAuthRepository {
  public users = new Map<string, AdminUserItem>();
  public shopsMap = new Map<string, AdminShopItem>();

  async userExists(userId: string): Promise<boolean> { return this.users.has(userId); }
  async getUserStatus(userId: string): Promise<UserStatus | null> { return this.users.get(userId)?.status ?? null; }
  async getUserRole(userId: string): Promise<'BUYER' | 'SELLER' | 'ADMIN' | null> { return this.users.get(userId)?.role ?? null; }
  async updateUserStatus(_trx: unknown, userId: string, status: UserStatus): Promise<{ user_id: string; status: UserStatus; updated_at: string }> {
    const u = this.users.get(userId);
    if (!u) throw new Error('User not found');
    u.status = status;
    return { user_id: u.id, status: u.status, updated_at: new Date().toISOString() };
  }
  async shopExists(shopId: string): Promise<boolean> { return this.shopsMap.has(shopId); }
  async hasRequiredShopProfile(): Promise<boolean> { return true; }
  async getShopStatus(shopId: string): Promise<'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | null> { return this.shopsMap.get(shopId)?.status ?? null; }
  async updateShopStatus(_trx: unknown, shopId: string, status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED'): Promise<{ shop_id: string; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED'; updated_at: string }> {
    const s = this.shopsMap.get(shopId);
    if (!s) throw new Error('Shop not found');
    s.status = status;
    return { shop_id: s.shop_id, status: s.status, updated_at: new Date().toISOString() };
  }
  async findUserById(id: string) {
    const u = this.users.get(id);
    return u ? { id: u.id, email: u.email, role: u.role, status: u.status } : null;
  }
  async findShopByOwnerId(_ownerId: string): Promise<string | null> { return null; }
  async productExists(): Promise<boolean> { return false; }
  async getProductStatus(): Promise<'ACTIVE' | 'HIDDEN' | null> { return null; }
  async updateProductStatus(): Promise<never> { throw new Error('Not implemented'); }
  async reviewExists(): Promise<boolean> { return false; }
  async insertModerationRecord(): Promise<void> {}

  async listUsers(params?: { role?: string; status?: string; search?: string }): Promise<AdminUserItem[]> {
    let list = Array.from(this.users.values());
    if (params?.role && params.role !== 'ALL') list = list.filter(u => u.role === params.role);
    if (params?.status && params.status !== 'ALL') list = list.filter(u => u.status === params.status);
    if (params?.search) list = list.filter(u => u.email.includes(params.search!) || u.full_name.includes(params.search!));
    return list;
  }

  async getUserDetail(userId: string): Promise<AdminUserItem | null> {
    return this.users.get(userId) ?? null;
  }

  async listShops(params?: { status?: string; search?: string }): Promise<AdminShopItem[]> {
    let list = Array.from(this.shopsMap.values());
    if (params?.status && params.status !== 'ALL') list = list.filter(s => s.status === params.status);
    if (params?.search) list = list.filter(s => s.shop_name.includes(params.search!));
    return list;
  }

  async getShopDetail(shopId: string): Promise<AdminShopItem | null> {
    return this.shopsMap.get(shopId) ?? null;
  }
}

describe('Admin Users & Shops Queries (ADMIN-03 & ADMIN-04 TDD)', () => {
  let repo: MockUserShopRepository;
  let authMiddleware: ReturnType<typeof createAuthMiddleware>;
  const adminId = '11111111-1111-4111-8111-111111111111';
  const targetUserId = '22222222-2222-4222-8222-222222222222';
  const targetShopId = '33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    repo = new MockUserShopRepository();
    repo.users.set(adminId, {
      id: adminId,
      email: 'admin@dino.vn',
      full_name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    repo.users.set(targetUserId, {
      id: targetUserId,
      email: 'buyer@dino.vn',
      full_name: 'Buyer Sample',
      role: 'BUYER',
      status: 'ACTIVE',
      created_at: '2026-01-02T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    });
    repo.shopsMap.set(targetShopId, {
      shop_id: targetShopId,
      shop_name: 'Dino Book Store',
      status: 'ACTIVE',
      owner_id: targetUserId,
      owner_email: 'buyer@dino.vn',
      product_count: 12,
      contact_phone: '0901234567',
      pickup_address: '123 Nguyen Hue, Q1, HCMC',
      description: 'Cửa hàng sách uy tín',
      logo_url: null,
      created_at: '2026-01-03T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    });

    authMiddleware = createAuthMiddleware(
      repo,
      new StubTokenVerifier()
    );
  });

  it('GET /api/v1/admin/users/:id returns user detail', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listUsers: repo.listUsers.bind(repo),
        getUserDetail: repo.getUserDetail.bind(repo),
        moderateTarget: async () => ({ target_id: '', target_type: 'USER', action: 'LOCK', status: 'LOCKED', updated_at: '' }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    const res = await request(app)
      .get(`/api/v1/admin/users/${targetUserId}`)
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(200);

    assert.ok(res.body.data);
    assert.equal(res.body.data.id, targetUserId);
    assert.equal(res.body.data.email, 'buyer@dino.vn');
    assert.equal(res.body.data.fullName, 'Buyer Sample');
  });

  it('GET /api/v1/admin/users/:id returns 404 if user not found', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listUsers: repo.listUsers.bind(repo),
        getUserDetail: repo.getUserDetail.bind(repo),
        moderateTarget: async () => ({ target_id: '', target_type: 'USER', action: 'LOCK', status: 'LOCKED', updated_at: '' }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    await request(app)
      .get('/api/v1/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(404);
  });

  it('GET /api/v1/admin/shops/:id returns shop detail with contact and pickup address', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listShops: repo.listShops.bind(repo),
        getShopDetail: repo.getShopDetail.bind(repo),
        moderateTarget: async () => ({ target_id: '', target_type: 'SHOP', action: 'LOCK', status: 'LOCKED', updated_at: '' }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    const res = await request(app)
      .get(`/api/v1/admin/shops/${targetShopId}`)
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(200);

    assert.ok(res.body.data);
    assert.equal(res.body.data.id, targetShopId);
    assert.equal(res.body.data.name, 'Dino Book Store');
    assert.equal(res.body.data.contactPhone, '0901234567');
    assert.equal(res.body.data.pickupAddress, '123 Nguyen Hue, Q1, HCMC');
  });

  it('GET /api/v1/admin/shops/:id returns 404 if shop not found', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listShops: repo.listShops.bind(repo),
        getShopDetail: repo.getShopDetail.bind(repo),
        moderateTarget: async () => ({ target_id: '', target_type: 'SHOP', action: 'LOCK', status: 'LOCKED', updated_at: '' }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    await request(app)
      .get('/api/v1/admin/shops/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(404);
  });

  it('GET /api/v1/admin/users?cursor=... returns paginated envelope with meta', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listUsers: repo.listUsers.bind(repo),
        listUsersPage: async (params: { limit?: number }) => ({
          items: [{ id: targetUserId, email: 'buyer@dino.vn', fullName: 'Buyer Sample', role: 'BUYER', status: 'ACTIVE', createdAt: '2026-01-02T00:00:00Z' }],
          limit: params.limit ?? 20,
          has_more: false,
          next_cursor: null,
        }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    const res = await request(app)
      .get('/api/v1/admin/users?limit=10')
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(200);

    assert.ok(res.body.data);
    assert.ok(res.body.meta);
    assert.equal(res.body.meta.limit, 10);
    assert.equal(res.body.meta.has_more, false);
  });

  it('GET /api/v1/admin/shops?cursor=... returns paginated envelope with meta', async () => {
    const app = createApp({
      authRepository: repo,
      moderation: {
        listShops: repo.listShops.bind(repo),
        listShopsPage: async (params: { limit?: number }) => ({
          items: [{ id: targetShopId, name: 'Dino Book Store', status: 'ACTIVE', productCount: 12 }],
          limit: params.limit ?? 20,
          has_more: false,
          next_cursor: null,
        }),
      } as unknown as IModerationService,
      auth: authMiddleware,
    });

    const res = await request(app)
      .get('/api/v1/admin/shops?limit=10')
      .set('Authorization', `Bearer stub-token-${adminId}`)
      .expect(200);

    assert.ok(res.body.data);
    assert.ok(res.body.meta);
    assert.equal(res.body.meta.limit, 10);
    assert.equal(res.body.meta.has_more, false);
  });
});
