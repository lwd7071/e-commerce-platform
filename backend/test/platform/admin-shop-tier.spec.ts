import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { createRuntimeApp } from '../../src/platform/http/app.ts';
import { StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const SHOP_ID = '00000000-0000-4000-8000-000000000001';
const PRODUCT_ID = '00000000-0000-4000-8000-000000000010';

const testEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
  DIRECT_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
  SUPABASE_URL: 'https://proj123.supabase.co',
  SUPABASE_JWKS_URL: 'https://proj123.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_SECRET: 'test-secret',
};

interface MockShop {
  shop_id: string;
  owner_id: string;
  shop_name: string;
  description: string | null;
  logo_url: string | null;
  pickup_address: string;
  contact_phone: string;
  status: string;
  tier: string;
  tier_override: boolean;
  tier_override_reason: string | null;
  tier_overridden_at: string | null;
  tier_override_by: string | null;
  created_at: string;
  updated_at: string;
}

function createMockPool(initialTier = 'STANDARD') {
  let currentShop: MockShop = {
    shop_id: SHOP_ID,
    owner_id: SELLER_ID,
    shop_name: 'Dino Official Store',
    description: 'Chuyên cung cấp sản phẩm chính hãng',
    logo_url: null,
    pickup_address: '123 Đường Nguyễn Huệ, Q1, TP.HCM',
    contact_phone: '0901234567',
    status: 'ACTIVE',
    tier: initialTier,
    tier_override: initialTier !== 'STANDARD',
    tier_override_reason: initialTier !== 'STANDARD' ? 'Initial override' : null,
    tier_overridden_at: initialTier !== 'STANDARD' ? new Date().toISOString() : null,
    tier_override_by: initialTier !== 'STANDARD' ? ADMIN_ID : null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const auditLogs: Array<{ action: string; target_type: string; target_id: string; reason: string; details: unknown }> = [];

  const mockClient = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }

      // SELECT 1 FROM shops WHERE shop_id = $1
      if (sql.includes('SELECT 1 FROM shops WHERE shop_id = $1')) {
        const id = params[0];
        if (id === SHOP_ID) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // SELECT tier FROM shops WHERE shop_id = $1
      if (sql.includes('SELECT tier FROM shops WHERE shop_id = $1')) {
        const id = params[0];
        if (id === SHOP_ID) {
          return { rows: [{ tier: currentShop.tier }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // UPDATE shops SET tier = $1, tier_override = true ...
      if (sql.includes('UPDATE shops') && sql.includes('tier = $1')) {
        const [tier, reason, adminId, shopId] = params as [string, string, string, string];
        if (shopId === SHOP_ID) {
          currentShop = {
            ...currentShop,
            tier,
            tier_override: true,
            tier_override_reason: reason,
            tier_overridden_at: new Date().toISOString(),
            tier_override_by: adminId,
            updated_at: new Date().toISOString(),
          };
          return {
            rows: [currentShop],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // INSERT INTO admin_logs
      if (sql.includes('INSERT INTO admin_logs')) {
        auditLogs.push({
          action: params[2] as string,
          target_type: params[3] as string,
          target_id: params[4] as string,
          reason: params[5] as string,
          details: params[6],
        });
        return { rows: [], rowCount: 1 };
      }

      // GET /admin/shops
      if (sql.includes('FROM shops s') && sql.includes('JOIN app_users u')) {
        return {
          rows: [{
            ...currentShop,
            product_count: 5,
            owner_email: 'seller@dino.vn',
            owner_name: 'Dino Seller',
          }],
          rowCount: 1,
        };
      }

      // Default
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient as unknown as PoolClient,
    query: async (sql: string, params: unknown[] = []) => {
      // User auth check
      if (sql.includes('FROM app_users WHERE user_id')) {
        const targetId = params[0] as string;
        const role = targetId === ADMIN_ID ? 'ADMIN' : (targetId === SELLER_ID ? 'SELLER' : 'BUYER');
        return {
          rows: [{
            id: targetId,
            user_id: targetId,
            email: `${role.toLowerCase()}@dino.vn`,
            role,
            status: 'ACTIVE',
            fullName: `${role} User`,
            full_name: `${role} User`,
            shop_id: role === 'SELLER' ? SHOP_ID : null,
            shop_status: role === 'SELLER' ? 'ACTIVE' : null,
          }],
          rowCount: 1,
        };
      }

      // Seller shop check
      if (sql.includes('FROM shops') && (sql.includes('owner_id = $1') || sql.includes('WHERE shop_id = $1'))) {
        return {
          rows: [currentShop],
          rowCount: 1,
        };
      }

      // Shop detail
      if (sql.includes('FROM shops WHERE shop_id = $1') || (sql.includes('FROM shops s') && sql.includes('s.shop_id = $1'))) {
        const shopId = params[0] as string;
        if (shopId === SHOP_ID) {
          return {
            rows: [{
              ...currentShop,
              owner_email: 'seller@dino.vn',
              owner_name: 'Dino Seller',
              product_count: 5,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Product query
      if (sql.includes('FROM products p') && sql.includes('JOIN shops s')) {
        // If query has s.tier filter
        if (sql.includes('s.tier = $')) {
          const tierParam = params.find((p) => p === 'MALL' || p === 'PREFERRED' || p === 'STANDARD');
          if (tierParam !== currentShop.tier) {
            return { rows: [{ count: '0' }], rowCount: 1 };
          }
        }

        if (sql.includes('COUNT(*)')) {
          return { rows: [{ count: '1' }], rowCount: 1 };
        }

        return {
          rows: [{
            product_id: PRODUCT_ID,
            shop_id: SHOP_ID,
            category_id: '00000000-0000-4000-8000-000000000020',
            product_name: 'Áo Polo Dino Chính Hãng',
            description: 'Chất liệu cotton cao cấp',
            created_at: '2026-02-01T00:00:00Z',
            shop_tier: currentShop.tier,
            min_price: '250000.00',
            max_price: '250000.00',
            total_stock: 50,
            image_url: 'https://example.com/polo.jpg',
          }],
          rowCount: 1,
        };
      }

      return mockClient.query(sql, params);
    },
  } as unknown as Pool;

  return { pool, auditLogs, getShop: () => currentShop };
}

describe('Admin Shop Tiering & Moderation Flow (Batch A)', () => {
  it('Admin updates shop tier to MALL with valid reason -> 200, updates tier and logs audit', async () => {
    const { pool, auditLogs, getShop } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({
        tier: 'MALL',
        reason: 'Được chứng nhận đại lý phân phối chính hãng',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.shop_id, SHOP_ID);
    assert.equal(res.body.data.tier, 'MALL');
    assert.equal(res.body.data.tier_override, true);
    assert.equal(res.body.data.tier_override_reason, 'Được chứng nhận đại lý phân phối chính hãng');

    // Verify DB update
    assert.equal(getShop().tier, 'MALL');
    assert.equal(getShop().tier_override, true);

    // Verify audit log
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'SHOP_TIER_UPDATE');
    assert.equal(auditLogs[0].target_type, 'SHOP');
    assert.equal(auditLogs[0].target_id, SHOP_ID);
    assert.match(auditLogs[0].reason, /Được chứng nhận đại lý phân phối chính hãng/);
  });

  it('Admin updates shop tier to PREFERRED with valid reason -> 200', async () => {
    const { pool, auditLogs } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({
        tier: 'PREFERRED',
        reason: 'Shop đạt tiêu chuẩn đánh giá 4.9 sao và phản hồi nhanh',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.tier, 'PREFERRED');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0].action, 'SHOP_TIER_UPDATE');
  });

  it('Admin updates shop tier without reason -> 422 REASON_REQUIRED', async () => {
    const { pool, auditLogs } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({
        tier: 'MALL',
        reason: '   ',
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'REASON_REQUIRED');
    assert.equal(auditLogs.length, 0);
  });

  it('Admin updates shop tier with invalid tier value -> 422 VALIDATION_FAILED', async () => {
    const { pool, auditLogs } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({
        tier: 'DIAMOND',
        reason: 'Upgrade to Diamond tier',
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
    assert.equal(auditLogs.length, 0);
  });

  it('Seller cannot update tier via /admin/shops/:id/tier -> 403 FORBIDDEN', async () => {
    const { pool } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${SELLER_ID}`)
      .send({
        tier: 'MALL',
        reason: 'Seller trying to promote own shop',
      });

    assert.equal(res.status, 403);
  });

  it('Buyer cannot update tier via /admin/shops/:id/tier -> 403 FORBIDDEN', async () => {
    const { pool } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
      .send({
        tier: 'MALL',
        reason: 'Buyer trying to change shop tier',
      });

    assert.equal(res.status, 403);
  });

  it('Unauthenticated user cannot update tier -> 401 UNAUTHORIZED', async () => {
    const { pool } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch(`/api/v1/admin/shops/${SHOP_ID}/tier`)
      .send({
        tier: 'MALL',
        reason: 'No auth',
      });

    assert.equal(res.status, 401);
  });

  it('Seller cannot update tier or metadata override via /seller/shop -> 422 ValidationFailedError', async () => {
    const { pool } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .patch('/api/v1/seller/shop')
      .set('Authorization', `Bearer stub-token-${SELLER_ID}`)
      .send({
        tier: 'MALL',
      });

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
    assert.match(res.body.error.message, /Unknown field: tier/i);
  });

  it('Public catalog GET /products?shop_tier=MALL filters and returns shop_tier', async () => {
    const { pool } = createMockPool('MALL');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .get('/api/v1/products?shop_tier=MALL');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].shop_tier, 'MALL');
  });

  it('Public catalog GET /products?shop_tier=INVALID returns 422 validation error', async () => {
    const { pool } = createMockPool('STANDARD');
    const runtime = createRuntimeApp(testEnv, {
      pool,
      tokenVerifier: new StubTokenVerifier(),
    });

    const res = await request(runtime.app)
      .get('/api/v1/products?shop_tier=GOLD');

    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'VALIDATION_FAILED');
  });
});
