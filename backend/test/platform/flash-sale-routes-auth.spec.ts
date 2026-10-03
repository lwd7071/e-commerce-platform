import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { createFlashSaleRouter } from '../../src/modules/flash-sale/routes/flash-sale.routes.ts';
import type { FlashSaleService } from '../../src/modules/flash-sale/services/flash-sale.service.ts';
import type { PgFlashSaleRepository } from '../../src/modules/flash-sale/repositories/pg-flash-sale.repository.ts';
import { createAuthMiddleware, StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import type { IAuthRepository } from '../../src/modules/identity/repositories/auth.repository.ts';
import type { AuthUserRecord } from '../../src/modules/identity/domain/types.ts';
import { errorHandlerMiddleware } from '../../src/platform/http/middlewares/error-handler.ts';
import { requestIdMiddleware } from '../../src/platform/http/middlewares/request-id.ts';
import { FlashSaleLuaCode, type PurchaseFlashSaleCommand } from '../../src/modules/flash-sale/domain/flash-sale.types.ts';

class InMemoryAuthRepository implements IAuthRepository {
  public users = new Map<string, AuthUserRecord>();

  async findUserById(userId: string): Promise<AuthUserRecord | null> {
    return this.users.get(userId) ?? null;
  }

  async findShopByOwnerId(_ownerId: string): Promise<string | null> {
    return null;
  }
}

describe('Flash Sale Routes Auth & RBAC (Task 1)', () => {
  let authRepo: InMemoryAuthRepository;
  let mockService: Partial<FlashSaleService>;
  let mockRepo: Partial<PgFlashSaleRepository>;
  let lastPurchaseCommand: PurchaseFlashSaleCommand | null = null;
  let app: express.Express;

  beforeEach(() => {
    authRepo = new InMemoryAuthRepository();
    lastPurchaseCommand = null;

    authRepo.users.set('buyer-1', {
      id: 'buyer-1',
      email: 'buyer@test.com',
      role: 'BUYER',
      status: 'ACTIVE',
    });

    authRepo.users.set('admin-1', {
      id: 'admin-1',
      email: 'admin@test.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    authRepo.users.set('locked-user', {
      id: 'locked-user',
      email: 'locked@test.com',
      role: 'BUYER',
      status: 'LOCKED',
    });

    mockRepo = {
      listActiveSessions: async () => [
        {
          slot_id: 'slot-1',
          slot_name: 'Flash Sale 12:00',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString(),
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      listItemsBySlotId: async (_slotId: string) => [
        {
          item_id: 'item-1',
          slot_id: 'slot-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          original_price: '100000',
          flash_sale_price: '50000',
          allocated_stock: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      findItemById: async (itemId: string) => {
        if (itemId === 'item-1') {
          return {
            item_id: 'item-1',
            slot_id: 'slot-1',
            product_id: 'prod-1',
            variant_id: 'var-1',
            original_price: '100000',
            flash_sale_price: '50000',
            allocated_stock: 10,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
        return null;
      },
    };

    mockService = {
      warmUpSlot: async (_slotId: string) => ({ success: true, message: 'Warmed up' }),
      purchase: async (cmd: PurchaseFlashSaleCommand) => {
        lastPurchaseCommand = cmd;
        return {
          success: true,
          order_id: 'order-123',
          code: FlashSaleLuaCode.SUCCESS,
          message: 'Đặt hàng thành công.',
        };
      },
      reconcileSlot: async (_slotId: string) => ({
        slot_id: 'slot-1',
        slot_name: 'Flash Sale 12:00',
        allocated_stock: 10,
        remaining_redis_stock: 8,
        sold_via_redis: 2,
        valid_orders_in_db: 2,
        compensation_applied_count: 0,
        discrepancy: 0,
        is_balanced: true,
        timestamp: new Date().toISOString(),
      }),
      runWatchdogSweep: async () => ({
        swept: 0,
        selfHealed: 0,
        compensated: 0,
      }),
    };

    const authMiddleware = createAuthMiddleware(authRepo, new StubTokenVerifier());
    const mockRedis = {
      get: async () => '10',
      set: async () => 'OK',
      del: async () => 1,
    };

    app = express();
    app.use(requestIdMiddleware);
    app.use(express.json());
    app.use(
      '/api/v1/flash-sales',
      createFlashSaleRouter(
        mockService as FlashSaleService,
        mockRepo as PgFlashSaleRepository,
        authMiddleware,
        mockRedis
      )
    );
    app.use(errorHandlerMiddleware);
  });

  it('1.1: Từ chối thiếu Bearer token -> 401 AUTH_REQUIRED', async () => {
    const res = await request(app)
      .post('/api/v1/flash-sales/items/item-1/purchase')
      .set('Idempotency-Key', 'idemp-12345678')
      .send({});

    assert.equal(res.status, 401);
    assert.equal(res.body.error?.code, 'AUTH_REQUIRED');
  });

  it('1.2: Từ chối token không hợp lệ / không có user_id -> 401 AUTH_INVALID_TOKEN', async () => {
    const res = await request(app)
      .post('/api/v1/flash-sales/items/item-1/purchase')
      .set('Authorization', 'Bearer stub-token-non-existent-user')
      .set('Idempotency-Key', 'idemp-12345678')
      .send({});

    assert.equal(res.status, 401);
    assert.equal(res.body.error?.code, 'AUTH_INVALID_TOKEN');
  });

  it('1.3: Lấy định danh từ JWT context, bỏ qua user_id giả mạo trong body', async () => {
    const jwtUserId = 'buyer-1';
    const fakeBodyUserId = 'attacker-user-id-999';

    const res = await request(app)
      .post('/api/v1/flash-sales/items/item-1/purchase')
      .set('Authorization', `Bearer stub-token-${jwtUserId}`)
      .set('Idempotency-Key', 'idemp-12345678-test')
      .send({ user_id: fakeBodyUserId });

    assert.equal(res.status, 200);
    assert.ok(lastPurchaseCommand, 'purchase() should have been called');
    assert.equal(lastPurchaseCommand.user_id, jwtUserId);
    assert.notEqual(lastPurchaseCommand.user_id, fakeBodyUserId);
  });

  it('1.4: Chặn Buyer gọi các route vận hành Admin -> 403 RESOURCE_FORBIDDEN', async () => {
    const endpoints = [
      { method: 'post', path: '/api/v1/flash-sales/slots/slot-1/warm-up' },
      { method: 'get', path: '/api/v1/flash-sales/slots/slot-1/reconcile' },
      { method: 'post', path: '/api/v1/flash-sales/slots/slot-1/reconcile' },
      { method: 'post', path: '/api/v1/flash-sales/watchdog/sweep' },
    ];

    for (const ep of endpoints) {
      const reqInstance = (request(app) as any)[ep.method](ep.path)
        .set('Authorization', 'Bearer stub-token-buyer-1');
      const res = await reqInstance;
      assert.equal(
        res.status,
        403,
        `Endpoint ${ep.method.toUpperCase()} ${ep.path} should reject Buyer with 403`
      );
      assert.equal(res.body.error?.code, 'RESOURCE_FORBIDDEN');
    }
  });

  it('1.5: Cho phép Admin gọi các route vận hành -> 200 OK', async () => {
    const warmUpRes = await request(app)
      .post('/api/v1/flash-sales/slots/slot-1/warm-up')
      .set('Authorization', 'Bearer stub-token-admin-1');
    assert.equal(warmUpRes.status, 200);

    const getReconcileRes = await request(app)
      .get('/api/v1/flash-sales/slots/slot-1/reconcile')
      .set('Authorization', 'Bearer stub-token-admin-1');
    assert.equal(getReconcileRes.status, 200);

    const postReconcileRes = await request(app)
      .post('/api/v1/flash-sales/slots/slot-1/reconcile')
      .set('Authorization', 'Bearer stub-token-admin-1')
      .send({ autoBalance: true });
    assert.equal(postReconcileRes.status, 200);

    const sweepRes = await request(app)
      .post('/api/v1/flash-sales/watchdog/sweep')
      .set('Authorization', 'Bearer stub-token-admin-1');
    assert.equal(sweepRes.status, 200);
  });

  it('1.6: Từ chối user bị khóa trong DB -> 403 USER_LOCKED', async () => {
    const res = await request(app)
      .post('/api/v1/flash-sales/items/item-1/purchase')
      .set('Authorization', 'Bearer stub-token-locked-user')
      .set('Idempotency-Key', 'idemp-12345678-test')
      .send({});

    assert.equal(res.status, 403);
    assert.equal(res.body.error?.code, 'USER_LOCKED');
  });

  it('1.7: Cho phép khách vãng lai xem danh sách khung giờ công khai -> 200 OK', async () => {
    const slotsRes = await request(app).get('/api/v1/flash-sales/slots');
    assert.equal(slotsRes.status, 200);
    assert.ok(Array.isArray(slotsRes.body.data));

    const itemsRes = await request(app).get('/api/v1/flash-sales/slots/slot-1/items');
    assert.equal(itemsRes.status, 200);
    assert.ok(Array.isArray(itemsRes.body.data));
  });
});
