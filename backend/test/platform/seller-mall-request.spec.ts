import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { createApp } from '../../src/platform/http/app.ts';
import { createRequestContext } from '../../src/platform/context/request-context.ts';
import { ShopMallRequestService } from '../../src/modules/shop/services/shop-mall-request.service.ts';
import { PgShopMallRequestRepository } from '../../src/modules/shop/repositories/pg-shop-mall-request.repository.ts';
import type { IAuditPort } from '../../src/contracts/audit.port.ts';
import type { ITargetLookupRepository } from '../../src/modules/moderation/domain/moderation.types.ts';
import {
  ConflictError,
  ReasonRequiredError,
  ValidationFailedError,
  AuditWriteFailedError,
} from '../../src/platform/errors/app-error.ts';

const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const SHOP_ID = '00000000-0000-4000-8000-000000000001';

interface MockShopRecord {
  shop_id: string;
  owner_id: string;
  shop_name: string;
  status: string;
  tier: string;
  tier_override: boolean;
  tier_override_reason: string | null;
  tier_override_by: string | null;
  tier_overridden_at: string | null;
  document_url?: string | null;
  created_at: string;
  updated_at: string;
}

interface MockMallRequestRecord {
  request_id: string;
  shop_id: string;
  seller_id: string;
  status: string;
  document_url: string;
  reason: string;
  admin_note: string | null;
  admin_id: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function createMockPool(initialTier = 'STANDARD') {
  let shop: MockShopRecord = {
    shop_id: SHOP_ID,
    owner_id: SELLER_ID,
    shop_name: 'Dino Official Store',
    status: 'ACTIVE',
    tier: initialTier,
    tier_override: initialTier === 'MALL',
    tier_override_reason: null,
    tier_override_by: null,
    tier_overridden_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  const requests: MockMallRequestRecord[] = [];
  const auditLogs: import('../../src/contracts/audit.port.ts').AdminAuditRecord[] = [];
  const moderationRecords: Array<{ target_type: string; target_id: string; action: string; reason?: string }> = [];

  let snapshotShop = { ...shop };
  let snapshotRequests: MockMallRequestRecord[] = [];

  const mockClient = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql === 'BEGIN') {
        snapshotShop = { ...shop };
        snapshotRequests = requests.map((r) => ({ ...r }));
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'COMMIT') {
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'ROLLBACK') {
        shop = { ...snapshotShop };
        requests.length = 0;
        requests.push(...snapshotRequests.map((r) => ({ ...r })));
        return { rows: [], rowCount: 0 };
      }

      // SELECT shop_id, owner_id, status, ... FROM shops WHERE shop_id = $1 FOR UPDATE
      if (sql.includes('FROM shops') && sql.includes('FOR UPDATE')) {
        const id = params[0];
        if (id === shop.shop_id) {
          return {
            rows: [{
              shop_id: shop.shop_id,
              owner_id: shop.owner_id,
              tier: shop.tier,
              status: shop.status,
              tier_override: shop.tier_override,
            }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // SELECT * FROM shop_mall_requests WHERE shop_id = $1 AND status = 'PENDING'
      if (sql.includes('FROM shop_mall_requests') && sql.includes("status = 'PENDING'")) {
        const shopId = params[0];
        const pending = requests.find((r) => r.shop_id === shopId && r.status === 'PENDING');
        return { rows: pending ? [pending] : [], rowCount: pending ? 1 : 0 };
      }

      // INSERT INTO shop_mall_requests
      if (sql.includes('INSERT INTO shop_mall_requests')) {
        const [shopId, sellerId, reason, docUrl] = params as [string, string, string, string];
        const record: MockMallRequestRecord = {
          request_id: randomUUID(),
          shop_id: shopId,
          seller_id: sellerId,
          status: 'PENDING',
          reason,
          document_url: docUrl,
          admin_note: null,
          admin_id: null,
          reviewed_at: null,
          cancelled_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        requests.push(record);
        return { rows: [record], rowCount: 1 };
      }

      // SELECT * FROM shop_mall_requests WHERE request_id = $1 FOR UPDATE
      if (sql.includes('FROM shop_mall_requests') && sql.includes('FOR UPDATE')) {
        const id = params[0];
        const reqItem = requests.find((r) => r.request_id === id);
        return { rows: reqItem ? [reqItem] : [], rowCount: reqItem ? 1 : 0 };
      }

      // UPDATE shop_mall_requests
      if (sql.includes('UPDATE shop_mall_requests')) {
        const [id, statusVal, adminId, note, reviewedAt, cancelledAt] = params as [string, string, string | null, string | null, string | null, string | null];
        const idx = requests.findIndex((r) => r.request_id === id);
        if (idx >= 0) {
          requests[idx] = {
            ...requests[idx]!,
            status: statusVal,
            admin_id: adminId ?? requests[idx]!.admin_id,
            admin_note: note ?? requests[idx]!.admin_note,
            reviewed_at: reviewedAt ?? requests[idx]!.reviewed_at,
            cancelled_at: cancelledAt ?? requests[idx]!.cancelled_at,
            updated_at: new Date().toISOString(),
          };
          return { rows: [requests[idx]!], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // SELECT ... FROM shop_mall_requests WHERE shop_id = $1 (ListByShop)
      if (sql.includes('FROM shop_mall_requests') && sql.includes('WHERE shop_id = $1')) {
        const shopId = params[0];
        const matched = requests.filter((r) => r.shop_id === shopId);
        return { rows: matched, rowCount: matched.length };
      }

      // SELECT ... FROM shop_mall_requests (ListAdmin)
      if (sql.includes('FROM shop_mall_requests')) {
        return { rows: requests, rowCount: requests.length };
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient as unknown as PoolClient,
    query: async (sql: string, params: unknown[] = []) => mockClient.query(sql, params),
  } as unknown as Pool;

  const targetLookup: ITargetLookupRepository = {
    shopExists: async () => true,
    userExists: async () => true,
    productExists: async () => true,
    reviewExists: async () => true,
    hasRequiredShopProfile: async () => true,
    updateShopStatus: async () => ({ shop_id: shop.shop_id, status: 'ACTIVE' as const, updated_at: new Date().toISOString() }),
    updateUserStatus: async () => ({ user_id: SELLER_ID, status: 'ACTIVE' as const, updated_at: new Date().toISOString() }),
    getUserStatus: async () => 'ACTIVE',
    updateShopTier: async (_trx, shopId, tier, reason, adminId) => {
      shop = {
        ...shop,
        tier,
        tier_override: true,
        tier_override_reason: reason,
        tier_override_by: adminId,
        tier_overridden_at: new Date().toISOString(),
      };
      return {
        shop_id: shopId,
        tier,
        tier_override: true,
        tier_override_reason: reason,
        tier_override_by: adminId,
        tier_overridden_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    },
    insertModerationRecord: async (_trx, record) => {
      moderationRecords.push(record);
    },
  };

  const auditPort: IAuditPort = {
    logAdminAction: async (_trx, record) => {
      auditLogs.push(record);
    },
  };

  return { pool, getShop: () => shop, getRequests: () => requests, auditLogs, moderationRecords, targetLookup, auditPort };
}

function createSellerCtx() {
  return createRequestContext({
    request_id: 'req_test',
    user_id: SELLER_ID,
    role: 'SELLER',
    shop_id: SHOP_ID,
    shop_status: 'ACTIVE',
  });
}

describe('Seller Mall Request Domain & Atomic Service Tests', () => {
  it('submits a new mall upgrade request successfully when eligible', async () => {
    const { pool, getRequests, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const ctx = createSellerCtx();

    const result = await service.submitRequest(ctx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
      document_url: 'https://docs.dino.vn/brand-authorization.pdf',
    });

    assert.equal(result.status, 'PENDING');
    assert.equal(result.shop_id, SHOP_ID);
    assert.equal(result.seller_id, SELLER_ID);
    assert.equal(result.document_url, 'https://docs.dino.vn/brand-authorization.pdf');
    assert.equal(getRequests().length, 1);
  });

  it('rejects submission if document_url is missing or invalid URL format', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const ctx = createSellerCtx();

    await assert.rejects(
      async () => {
        await service.submitRequest(ctx, {
          reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
          document_url: 'not-a-valid-url',
        });
      },
      (err: unknown) => err instanceof ValidationFailedError
    );
  });

  it('rejects submission if shop is already in MALL tier', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('MALL');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const ctx = createSellerCtx();

    await assert.rejects(
      async () => {
        await service.submitRequest(ctx, {
          reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
          document_url: 'https://docs.dino.vn/cert.pdf',
        });
      },
      (err: unknown) => err instanceof ConflictError && err.code === 'SHOP_ALREADY_MALL'
    );
  });

  it('rejects duplicate submission while another request is PENDING', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const ctx = createSellerCtx();

    await service.submitRequest(ctx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền lần 1',
      document_url: 'https://docs.dino.vn/first.pdf',
    });

    await assert.rejects(
      async () => {
        await service.submitRequest(ctx, {
          reason: 'Đăng ký đại lý chính hãng ủy quyền lần 2',
          document_url: 'https://docs.dino.vn/second.pdf',
        });
      },
      (err: unknown) => err instanceof ConflictError && err.code === 'PENDING_REQUEST_EXISTS'
    );
  });

  it('cancels a pending request', async () => {
    const { pool, getRequests, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const ctx = createSellerCtx();

    const created = await service.submitRequest(ctx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền cần hủy',
      document_url: 'https://docs.dino.vn/first.pdf',
    });
    const cancelled = await service.cancelRequest(ctx, created.request_id);

    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(getRequests()[0]?.status, 'CANCELLED');
  });

  it('admin approves pending request: upgrades shop tier to MALL and records audit trail', async () => {
    const { pool, getShop, auditLogs, moderationRecords, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const sellerCtx = createSellerCtx();

    const created = await service.submitRequest(sellerCtx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
      document_url: 'https://docs.dino.vn/cert.pdf',
    });
    assert.equal(getShop().tier, 'STANDARD');

    const approved = await service.approveRequest(ADMIN_ID, created.request_id, {
      note: 'Giấy tờ thương hiệu hợp lệ được công chứng.',
    });

    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.admin_id, ADMIN_ID);
    assert.equal(getShop().tier, 'MALL');
    assert.equal(getShop().tier_override, true);
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.action, 'SHOP_MALL_REQUEST_APPROVE');
    assert.equal(moderationRecords.length, 1);
    assert.equal(moderationRecords[0]?.action, 'UPDATE_TIER');
  });

  it('admin rejects approval if admin note is empty', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const sellerCtx = createSellerCtx();

    const created = await service.submitRequest(sellerCtx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
      document_url: 'https://docs.dino.vn/cert.pdf',
    });

    await assert.rejects(
      async () => {
        await service.approveRequest(ADMIN_ID, created.request_id, { note: '   ' });
      },
      (err: unknown) => err instanceof ReasonRequiredError
    );
  });

  it('admin rejects pending request with reason without changing shop tier', async () => {
    const { pool, getShop, auditLogs, moderationRecords, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const sellerCtx = createSellerCtx();

    const created = await service.submitRequest(sellerCtx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
      document_url: 'https://docs.dino.vn/cert.pdf',
    });

    const rejected = await service.rejectRequest(ADMIN_ID, created.request_id, {
      reason: 'Giấy ủy quyền đã quá hạn 6 tháng, vui lòng cập nhật bản mới.',
    });

    assert.equal(rejected.status, 'REJECTED');
    assert.equal(rejected.admin_note, 'Giấy ủy quyền đã quá hạn 6 tháng, vui lòng cập nhật bản mới.');
    assert.equal(getShop().tier, 'STANDARD');
    assert.equal(auditLogs.length, 1);
    assert.equal(auditLogs[0]?.action, 'SHOP_MALL_REQUEST_REJECT');
    assert.equal(moderationRecords.length, 0);
  });

  it('rolls back atomic transaction if audit logging fails', async () => {
    const { pool, getShop, targetLookup } = createMockPool('STANDARD');
    const failingAuditPort: IAuditPort = {
      logAdminAction: async () => {
        throw new Error('Database disk error on admin_logs');
      },
    };

    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, failingAuditPort);
    const sellerCtx = createSellerCtx();

    const created = await service.submitRequest(sellerCtx, {
      reason: 'Đăng ký đại lý chính hãng ủy quyền từ Apple Dino',
      document_url: 'https://docs.dino.vn/cert.pdf',
    });

    await assert.rejects(
      async () => {
        await service.approveRequest(ADMIN_ID, created.request_id, { note: 'Valid cert note' });
      },
      (err: unknown) => err instanceof AuditWriteFailedError
    );

    // Shop tier remains STANDARD due to rollback
    assert.equal(getShop().tier, 'STANDARD');
  });
});

describe('Seller Mall Request HTTP Integration & Guard Tests', () => {
  it('rejects POST /seller/shop/mall-requests when unauthenticated', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const app = createApp({
      mallRequestService: service,
    });

    const res = await request(app)
      .post('/api/v1/seller/shop/mall-requests')
      .send({ document_url: 'https://docs.dino.vn/brand.pdf' });

    assert.equal(res.status, 401);
  });

  it('rejects POST /seller/shop/mall-requests when user is BUYER', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req_test',
          user_id: BUYER_ID,
          role: 'BUYER',
        });
        next();
      },
      mallRequestService: service,
    });

    const res = await request(app)
      .post('/api/v1/seller/shop/mall-requests')
      .send({
        document_url: 'https://docs.dino.vn/brand.pdf',
        reason: 'Đăng ký nâng hạng Dino Mall chính hãng',
      });

    assert.equal(res.status, 403);
  });

  it('accepts POST /seller/shop/mall-requests with valid seller authentication', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req_test',
          user_id: SELLER_ID,
          role: 'SELLER',
          shop_id: SHOP_ID,
          shop_status: 'ACTIVE',
        });
        next();
      },
      mallRequestService: service,
    });

    const res = await request(app)
      .post('/api/v1/seller/shop/mall-requests')
      .send({
        document_url: 'https://docs.dino.vn/brand-authorization.pdf',
        reason: 'Đại lý chính hãng ủy quyền từ Dino Global',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.shop_id, SHOP_ID);
    assert.ok(res.body.request_id);
  });

  it('rejects GET /admin/shops/mall-requests when user is not ADMIN', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req_test',
          user_id: SELLER_ID,
          role: 'SELLER',
          shop_id: SHOP_ID,
        });
        next();
      },
      mallRequestService: service,
    });

    const res = await request(app).get('/api/v1/admin/shops/mall-requests');

    assert.equal(res.status, 403);
  });

  it('allows GET /admin/shops/mall-requests for ADMIN and returns list envelope', async () => {
    const { pool, targetLookup, auditPort } = createMockPool('STANDARD');
    const repo = new PgShopMallRequestRepository(pool);
    const service = new ShopMallRequestService(pool, repo, targetLookup, auditPort);
    const app = createApp({
      auth: (req, _res, next) => {
        req.context = createRequestContext({
          request_id: 'req_test',
          user_id: ADMIN_ID,
          role: 'ADMIN',
        });
        next();
      },
      mallRequestService: service,
    });

    const res = await request(app).get('/api/v1/admin/shops/mall-requests');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.meta);
    assert.ok(res.body.request_id);
  });
});
