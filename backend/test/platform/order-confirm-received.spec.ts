import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { createRuntimeApp } from '../../src/platform/http/app.ts';
import { StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_BUYER_ID = '99999999-9999-4999-8999-999999999999';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const ORDER_ID = '00000000-0000-4000-8000-000000000001';
const SHIPMENT_ID = '00000000-0000-4000-8000-000000000099';

function createMockPool(options: {
  orderStatus?: string;
  orderBuyerId?: string;
  shipmentStatus?: string | null;
  adminReason?: string;
} = {}) {
  const {
    orderStatus = 'SHIPPING',
    orderBuyerId = BUYER_ID,
    shipmentStatus = 'SHIPPING',
  } = options;

  let currentOrderStatus = orderStatus;
  let currentShipmentStatus = shipmentStatus;
  const executedQueries: string[] = [];

  const mockClient = {
    query: async (sql: string, params: unknown[] = []) => {
      executedQueries.push(sql);

      // Order query inside withTransaction
      if (sql.includes('FROM orders') && sql.includes('FOR UPDATE')) {
        const userId = params[1] as string;
        const role = params[2] as string;
        if (role === 'ADMIN' || userId === orderBuyerId) {
          return {
            rows: [{ status: currentOrderStatus, buyer_id: orderBuyerId }],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }

      // Shipment query inside withTransaction
      if (sql.includes('FROM shipments') && sql.includes('FOR UPDATE')) {
        if (!currentShipmentStatus) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [{ shipment_id: SHIPMENT_ID, status: currentShipmentStatus }],
          rowCount: 1,
        };
      }

      // Update shipment query
      if (sql.includes('UPDATE shipments SET status=')) {
        currentShipmentStatus = 'DELIVERED';
        return { rows: [], rowCount: 1 };
      }

      // Update orders query
      if (sql.includes('UPDATE orders SET status=$1')) {
        const newStatus = params[0] as string;
        const expectedFrom = params[3] as string;
        if (currentOrderStatus !== expectedFrom) {
          return { rows: [], rowCount: 0 };
        }
        currentOrderStatus = newStatus;
        return {
          rows: [{
            order_id: ORDER_ID,
            status: newStatus,
            buyer_id: orderBuyerId,
            shop_id: '00000000-0000-4000-8000-000000000002',
            subtotal: '100000.00',
            discount_amount: '0.00',
            shipping_fee: '0.00',
            total_amount: '100000.00',
          }],
          rowCount: 1,
        };
      }

      // Order status history insert
      if (sql.includes('INSERT INTO order_status_history')) {
        return { rows: [], rowCount: 1 };
      }

      // Admin logs insert
      if (sql.includes('INSERT INTO admin_logs')) {
        return { rows: [], rowCount: 1 };
      }

      // Order parties query for notification
      if (sql.includes('SELECT o.buyer_id,s.owner_id FROM orders')) {
        return {
          rows: [{ buyer_id: orderBuyerId, owner_id: SELLER_ID }],
          rowCount: 1,
        };
      }

      // Notifications insert
      if (sql.includes('INSERT INTO notifications')) {
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  };

  const pool = {
    connect: async () => mockClient as unknown as PoolClient,
    query: async (sql: string, params: unknown[] = []) => mockClient.query(sql, params),
  } as unknown as Pool;

  return { pool, mockClient, executedQueries };
}

function createTestRuntime(pool: Pool, _userContext: { userId: string; role: 'BUYER' | 'SELLER' | 'ADMIN'; shopId?: string }) {
  const testEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
    DIRECT_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
    SUPABASE_URL: 'https://proj123.supabase.co',
    SUPABASE_JWKS_URL: 'https://proj123.supabase.co/auth/v1/.well-known/jwks.json',
    SUPABASE_JWT_SECRET: 'test-secret',
  };

  const tokenVerifier = new StubTokenVerifier();

  // Mock pg-auth-repository user lookup
  const originalQuery = pool.query.bind(pool);
  pool.query = (async (sql: string, params: unknown[] = []) => {
    if (sql.includes('FROM app_users WHERE user_id')) {
      const targetId = params[0] as string;
      const role = targetId === ADMIN_ID ? 'ADMIN' : (targetId === SELLER_ID ? 'SELLER' : 'BUYER');
      return {
        rows: [{
          id: targetId,
          user_id: targetId,
          role,
          status: 'ACTIVE',
          shop_id: role === 'SELLER' ? '00000000-0000-4000-8000-000000000002' : null,
          shop_status: role === 'SELLER' ? 'ACTIVE' : null,
        }],
        rowCount: 1,
      };
    }
    return originalQuery(sql, params);
  }) as typeof pool.query;

  return createRuntimeApp(testEnv, {
    pool,
    tokenVerifier,
  });
}

describe('Runtime wiring & P0-9 shipment conditions for confirmReceived', () => {
  it('Buyer owner confirms receipt when Order is SHIPPING and Shipment exists -> 200 and transitions to COMPLETED', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'SHIPPING',
    });

    const runtime = createTestRuntime(pool, { userId: BUYER_ID, role: 'BUYER' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
      .send({})
      .expect(200);

    assert.strictEqual(res.body.data.status, 'COMPLETED');
    await runtime.close();
  });

  it('Buyer confirms receipt when Shipment is missing -> 409 SHIPMENT_REQUIRED (P0-9)', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: null, // missing shipment
    });

    const runtime = createTestRuntime(pool, { userId: BUYER_ID, role: 'BUYER' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
      .send({})
      .expect(409);

    assert.strictEqual(res.body.error.code, 'SHIPMENT_REQUIRED');
    await runtime.close();
  });

  it('Buyer non-owner is rejected with 404 (RESOURCE_NOT_FOUND)', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'SHIPPING',
    });

    const runtime = createTestRuntime(pool, { userId: OTHER_BUYER_ID, role: 'BUYER' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${OTHER_BUYER_ID}`)
      .send({})
      .expect(404);

    assert.strictEqual(res.body.error.code, 'RESOURCE_NOT_FOUND');
    await runtime.close();
  });

  it('Seller calling confirm-received is rejected with 403 ROLE_REQUIRED', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'SHIPPING',
    });

    const runtime = createTestRuntime(pool, { userId: SELLER_ID, role: 'SELLER' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${SELLER_ID}`)
      .send({})
      .expect(403);

    assert.strictEqual(res.body.error.code, 'ROLE_REQUIRED');
    await runtime.close();
  });

  it('Admin calling confirm-received without reason -> 422 REASON_REQUIRED', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'SHIPPING',
    });

    const runtime = createTestRuntime(pool, { userId: ADMIN_ID, role: 'ADMIN' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({})
      .expect(422);

    assert.strictEqual(res.body.error.code, 'REASON_REQUIRED');
    await runtime.close();
  });

  it('Admin calling confirm-received with missing Shipment -> 409 SHIPMENT_REQUIRED (P0-9)', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: null,
    });

    const runtime = createTestRuntime(pool, { userId: ADMIN_ID, role: 'ADMIN' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({ reason: 'Admin delivery intervention' })
      .expect(409);

    assert.strictEqual(res.body.error.code, 'SHIPMENT_REQUIRED');
    await runtime.close();
  });

  it('Admin calling confirm-received when Shipment is FAILED -> 409 SHIPMENT_INVALID_STATE', async () => {
    const { pool } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'FAILED',
    });

    const runtime = createTestRuntime(pool, { userId: ADMIN_ID, role: 'ADMIN' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({ reason: 'Admin delivery intervention' })
      .expect(409);

    assert.strictEqual(res.body.error.code, 'SHIPMENT_INVALID_STATE');
    await runtime.close();
  });

  it('Admin calling confirm-received with valid reason and shipment -> 200, updates shipment to DELIVERED and order to COMPLETED', async () => {
    const { pool, executedQueries } = createMockPool({
      orderStatus: 'SHIPPING',
      orderBuyerId: BUYER_ID,
      shipmentStatus: 'SHIPPING',
    });

    const runtime = createTestRuntime(pool, { userId: ADMIN_ID, role: 'ADMIN' });
    const res = await request(runtime.app)
      .post(`/api/v1/orders/${ORDER_ID}/confirm-received`)
      .set('Authorization', `Bearer stub-token-${ADMIN_ID}`)
      .send({ reason: 'Delivery evidence verified by Admin' })
      .expect(200);

    assert.strictEqual(res.body.data.status, 'COMPLETED');
    // Verify shipment was updated to DELIVERED
    assert.ok(executedQueries.some(q => q.includes('UPDATE shipments SET status=\'DELIVERED\'')));
    // Verify admin audit was logged
    assert.ok(executedQueries.some(q => q.includes('INSERT INTO admin_logs')));
    await runtime.close();
  });
});
