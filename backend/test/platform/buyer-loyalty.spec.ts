import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import type { Pool, PoolClient } from 'pg';
import { createRuntimeApp } from '../../src/platform/http/app.ts';
import { StubTokenVerifier } from '../../src/platform/http/middlewares/auth.ts';
import { LoyaltyService } from '../../src/modules/loyalty/services/loyalty.service.ts';
import { calculateLoyaltyAccrual, parseCents } from '../../src/modules/loyalty/domain/loyalty.types.ts';

const BUYER_ID = '11111111-1111-4111-8111-111111111111';
const SELLER_ID = '22222222-2222-4222-8222-222222222222';
const ADMIN_ID = '33333333-3333-4333-8333-333333333333';
const SHOP_ID = '00000000-0000-4000-8000-000000000001';

const testEnv: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
  DIRECT_URL: 'postgresql://postgres.proj123:secret@localhost:5432/postgres',
  SUPABASE_URL: 'https://proj123.supabase.co',
  SUPABASE_JWKS_URL: 'https://proj123.supabase.co/auth/v1/.well-known/jwks.json',
  SUPABASE_JWT_SECRET: 'test-secret',
};

interface MockUser {
  user_id: string;
  email: string;
  role: string;
  status: string;
  buyer_tier: string;
  total_spent: string;
  loyalty_points: number;
}

interface MockOrder {
  order_id: string;
  buyer_id: string;
  shop_id: string;
  recipient_name: string;
  recipient_phone: string;
  province: string;
  district: string;
  ward: string;
  delivery_address: string;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  total_amount: string;
  status: string;
  cancel_reason: string | null;
}

interface MockShipment {
  shipment_id: string;
  order_id: string;
  status: string;
}

interface MockLedgerEntry {
  transaction_id: string;
  user_id: string;
  points_delta: number;
  reference_order_id: string | null;
  reason: string;
  created_at: Date;
}

function createLoyaltyTestPool(initialSpent = '0.00', initialPoints = 0, initialTier = 'STANDARD') {
  const buyerUser: MockUser = {
    user_id: BUYER_ID,
    email: 'buyer@dino.vn',
    role: 'BUYER',
    status: 'ACTIVE',
    buyer_tier: initialTier,
    total_spent: initialSpent,
    loyalty_points: initialPoints,
  };

  const sellerUser: MockUser = {
    user_id: SELLER_ID,
    email: 'seller@dino.vn',
    role: 'SELLER',
    status: 'ACTIVE',
    buyer_tier: 'STANDARD',
    total_spent: '0.00',
    loyalty_points: 0,
  };

  const adminUser: MockUser = {
    user_id: ADMIN_ID,
    email: 'admin@dino.vn',
    role: 'ADMIN',
    status: 'ACTIVE',
    buyer_tier: 'STANDARD',
    total_spent: '0.00',
    loyalty_points: 0,
  };

  const orders: Map<string, MockOrder> = new Map();
  const shipments: Map<string, MockShipment> = new Map();
  const ledger: MockLedgerEntry[] = [];
  const statusHistory: Array<{ order_id: string; old_status: string; new_status: string; reason: string | null }> = [];
  const adminLogs: Array<{ action: string; target_id: string; reason: string }> = [];

  // Lock simulation for row-level concurrency
  let buyerLockPromise: Promise<void> = Promise.resolve();

  function acquireBuyerLock(): Promise<() => void> {
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    const currentLock = buyerLockPromise;
    buyerLockPromise = currentLock.then(() => nextLock);
    return currentLock.then(() => releaseLock);
  }

  const createClient = () => {
    let heldLockRelease: (() => void) | null = null;

    const client = {
      query: async (sql: string, params: unknown[] = []) => {
        if (sql === 'BEGIN') {
          return { rows: [], rowCount: 0 };
        }
        if (sql === 'COMMIT') {
          if (heldLockRelease) {
            heldLockRelease();
            heldLockRelease = null;
          }
          return { rows: [], rowCount: 0 };
        }
        if (sql === 'ROLLBACK') {
          if (heldLockRelease) {
            heldLockRelease();
            heldLockRelease = null;
          }
          return { rows: [], rowCount: 0 };
        }

        // Lock buyer row FOR UPDATE
        if (sql.includes('SELECT') && sql.includes('app_users') && sql.includes('FOR UPDATE')) {
          if (!heldLockRelease) {
            heldLockRelease = await acquireBuyerLock();
          }
          const userId = params[0];
          if (userId === BUYER_ID) {
            return {
              rows: [{
                user_id: buyerUser.user_id,
                buyer_tier: buyerUser.buyer_tier,
                total_spent: buyerUser.total_spent,
                loyalty_points: buyerUser.loyalty_points,
              }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }

        // Lock order row FOR UPDATE
        if (sql.includes('SELECT') && sql.includes('orders') && sql.includes('FOR UPDATE')) {
          const orderId = params[0];
          const order = orders.get(orderId as string);
          if (order) {
            return {
              rows: [{
                ...order,
                owner_id: SELLER_ID,
              }],
              rowCount: 1,
            };
          }
          return { rows: [], rowCount: 0 };
        }

        // SELECT app_users non-locking (auth or profile read)
        if (sql.includes('SELECT') && sql.includes('app_users')) {
          const userId = params[0];
          if (userId === BUYER_ID) return { rows: [{ id: BUYER_ID, ...buyerUser }], rowCount: 1 };
          if (userId === SELLER_ID) return { rows: [{ id: SELLER_ID, ...sellerUser }], rowCount: 1 };
          if (userId === ADMIN_ID) return { rows: [{ id: ADMIN_ID, ...adminUser }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        }

        // SELECT shipments WHERE order_id = $1
        if (sql.includes('SELECT') && sql.includes('shipments') && sql.includes('order_id')) {
          const orderId = params[0];
          const shipment = shipments.get(orderId as string);
          if (shipment) return { rows: [{ ...shipment }], rowCount: 1 };
          return { rows: [], rowCount: 0 };
        }

        // UPDATE shipments SET status='DELIVERED'
        if (sql.includes('UPDATE shipments SET status=\'DELIVERED\'')) {
          const shipmentId = params[0];
          for (const s of shipments.values()) {
            if (s.shipment_id === shipmentId) {
              s.status = 'DELIVERED';
              break;
            }
          }
          return { rows: [], rowCount: 1 };
        }

        // UPDATE orders SET status=$1 ...
        if (sql.includes('UPDATE orders SET status=$1')) {
          const [newStatus, cancelReason, orderId, fromStatus] = params as [string, string | null, string, string];
          const order = orders.get(orderId);
          if (order && order.status === fromStatus) {
            order.status = newStatus;
            order.cancel_reason = cancelReason;
            return { rows: [{ ...order }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // INSERT INTO order_status_history
        if (sql.includes('INSERT INTO order_status_history')) {
          const [, orderId, oldStatus, newStatus, , reason] = params as [string, string, string, string, string, string | null];
          statusHistory.push({ order_id: orderId, old_status: oldStatus, new_status: newStatus, reason });
          return { rows: [], rowCount: 1 };
        }

        // INSERT INTO admin_logs
        if (sql.includes('INSERT INTO admin_logs')) {
          const [, , action, , targetId, reason] = params as [string, string, string, string, string, string];
          adminLogs.push({ action, target_id: targetId, reason });
          return { rows: [], rowCount: 1 };
        }

        // Parties check
        if (sql.includes('SELECT o.buyer_id,s.owner_id FROM orders o')) {
          return { rows: [{ buyer_id: BUYER_ID, owner_id: SELLER_ID }], rowCount: 1 };
        }

        // INSERT notifications
        if (sql.includes('INSERT INTO notifications')) {
          return { rows: [], rowCount: 1 };
        }

        // INSERT INTO loyalty_point_transactions ... ON CONFLICT (reference_order_id)
        if (sql.includes('INSERT INTO loyalty_point_transactions')) {
          const [txId, userId, pointsDelta, refOrderId] = params as [string, string, number, string | null];
          if (refOrderId) {
            const exists = ledger.some(l => l.reference_order_id === refOrderId && l.reason === 'ORDER_COMPLETED');
            if (exists) {
              // ON CONFLICT DO NOTHING returns rowCount 0
              return { rows: [], rowCount: 0 };
            }
          }

          const entry: MockLedgerEntry = {
            transaction_id: txId,
            user_id: userId,
            points_delta: pointsDelta,
            reference_order_id: refOrderId,
            reason: 'ORDER_COMPLETED',
            created_at: new Date(),
          };
          ledger.push(entry);
          return { rows: [{ transaction_id: txId }], rowCount: 1 };
        }

        // UPDATE app_users SET buyer_tier=$1, total_spent=$2, loyalty_points=loyalty_points+$3
        if (sql.includes('UPDATE app_users') && sql.includes('buyer_tier = $1')) {
          const [newTier, newTotalSpent, pointsDelta, userId] = params as [string, string, number, string];
          if (userId === BUYER_ID) {
            buyerUser.buyer_tier = newTier;
            buyerUser.total_spent = newTotalSpent;
            buyerUser.loyalty_points += pointsDelta;
            return { rows: [{ ...buyerUser }], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // COUNT from loyalty_point_transactions
        if (sql.includes('COUNT(*)') && sql.includes('loyalty_point_transactions')) {
          const count = ledger.filter(l => l.user_id === params[0]).length;
          return { rows: [{ count: String(count) }], rowCount: 1 };
        }

        // SELECT from loyalty_point_transactions
        if (sql.includes('FROM loyalty_point_transactions') && sql.includes('WHERE user_id = $1')) {
          const userEntries = ledger.filter(l => l.user_id === params[0]);
          return { rows: userEntries, rowCount: userEntries.length };
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {
        if (heldLockRelease) {
          heldLockRelease();
          heldLockRelease = null;
        }
      },
    };

    return client;
  };

  const mockPool = {
    connect: async () => createClient() as unknown as PoolClient,
    query: async (sql: string, params: unknown[] = []) => {
      const client = createClient();
      try {
        return await client.query(sql, params);
      } finally {
        client.release();
      }
    },
    end: async () => {},
  } as unknown as Pool;

  return {
    pool: mockPool,
    addOrder: (order: MockOrder, shipmentStatus = 'SHIPPING') => {
      orders.set(order.order_id, { ...order });
      shipments.set(order.order_id, {
        shipment_id: `ship-${order.order_id}`,
        order_id: order.order_id,
        status: shipmentStatus,
      });
    },
    getBuyer: () => ({ ...buyerUser }),
    getLedger: () => [...ledger],
    setBuyerSpent: (spent: string, points: number, tier: string) => {
      buyerUser.total_spent = spent;
      buyerUser.loyalty_points = points;
      buyerUser.buyer_tier = tier;
    },
  };
}

describe('Buyer Loyalty & DinoPoint Integration (Batch B)', () => {
  it('P0-1 & P0-2: calculates eligible amount excluding shipping, grants 1 point per 10k VND', () => {
    // subtotal = 200k, discount = 50k, shipping = 30k (total 180k)
    // eligible amount = 200k - 50k = 150k
    // points = floor(150k / 10k) = 15 points
    const res = calculateLoyaltyAccrual({
      oldTotalSpentCents: 0n,
      oldTier: 'STANDARD',
      subtotalCents: parseCents('200000.00'),
      discountCents: parseCents('50000.00'),
    });

    assert.equal(res.eligibleCents, parseCents('150000.00'));
    assert.equal(res.pointsDelta, 15);
    assert.equal(res.newTotalSpentCents, parseCents('150000.00'));
    assert.equal(res.newTier, 'STANDARD');
  });

  it('P0-2: sub-10k order grants 0 points but increases total_spent', () => {
    const res = calculateLoyaltyAccrual({
      oldTotalSpentCents: parseCents('100000.00'),
      oldTier: 'STANDARD',
      subtotalCents: parseCents('5000.00'),
      discountCents: 0n,
    });

    assert.equal(res.eligibleCents, parseCents('5000.00'));
    assert.equal(res.pointsDelta, 0); // 0 points
    assert.equal(res.newTotalSpentCents, parseCents('105000.00')); // total spent increases
    assert.equal(res.newTier, 'STANDARD');
  });

  it('P0-3: multiplier on tier crossing uses old tier under lock (STANDARD gets x1, reaches VIP)', () => {
    // Buyer has 4.950.000đ, completes 100.000đ order -> total becomes 5.050.000đ (VIP)
    // Multiplier for this order must be x1 (10 pts), NOT x2
    const res = calculateLoyaltyAccrual({
      oldTotalSpentCents: parseCents('4950000.00'),
      oldTier: 'STANDARD',
      subtotalCents: parseCents('100000.00'),
      discountCents: 0n,
    });

    assert.equal(res.pointsDelta, 10); // x1
    assert.equal(res.newTotalSpentCents, parseCents('5050000.00'));
    assert.equal(res.newTier, 'VIP');
  });

  it('P0-3: VIP buyer enjoys x2 points on next order', () => {
    // Buyer already VIP (5.050.000đ), completes 100.000đ order -> gets 20 pts
    const res = calculateLoyaltyAccrual({
      oldTotalSpentCents: parseCents('5050000.00'),
      oldTier: 'VIP',
      subtotalCents: parseCents('100000.00'),
      discountCents: 0n,
    });

    assert.equal(res.pointsDelta, 20); // x2
    assert.equal(res.newTotalSpentCents, parseCents('5150000.00'));
    assert.equal(res.newTier, 'VIP');
  });

  it('Concurrency Case 1: Buyer at 4.900.000đ completes two 100.000đ orders concurrently -> first gets x1, second gets x2', async () => {
    const fixture = createLoyaltyTestPool('4900000.00', 490, 'STANDARD');
    const tokenVerifier = new StubTokenVerifier();

    const orderId1 = '11111111-0000-4000-8000-000000000001';
    const orderId2 = '11111111-0000-4000-8000-000000000002';

    fixture.addOrder({
      order_id: orderId1,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    fixture.addOrder({
      order_id: orderId2,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    const runtime = createRuntimeApp(testEnv, { pool: fixture.pool, tokenVerifier });

    try {
      // Fire two confirmReceived concurrently
      const [res1, res2] = await Promise.all([
        request(runtime.app)
          .post(`/api/v1/orders/${orderId1}/confirm-received`)
          .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
          .send({}),
        request(runtime.app)
          .post(`/api/v1/orders/${orderId2}/confirm-received`)
          .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
          .send({}),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      const buyer = fixture.getBuyer();
      assert.equal(buyer.total_spent, '5100000.00');
      assert.equal(buyer.buyer_tier, 'VIP');

      // First order granted 10 points (x1), second order granted 20 points (x2)
      // Initial 490 + 10 + 20 = 520 points!
      assert.equal(buyer.loyalty_points, 520);

      const ledger = fixture.getLedger();
      assert.equal(ledger.length, 2);
      const deltas = ledger.map(l => l.points_delta).sort((a, b) => a - b);
      assert.deepEqual(deltas, [10, 20]);
    } finally {
      await runtime.close();
    }
  });

  it('Concurrency Case 2: Buyer at 4.800.000đ completes two 100.000đ orders concurrently -> both get x1, then reaches VIP', async () => {
    const fixture = createLoyaltyTestPool('4800000.00', 480, 'STANDARD');
    const tokenVerifier = new StubTokenVerifier();

    const orderId1 = '22222222-0000-4000-8000-000000000001';
    const orderId2 = '22222222-0000-4000-8000-000000000002';

    fixture.addOrder({
      order_id: orderId1,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    fixture.addOrder({
      order_id: orderId2,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    const runtime = createRuntimeApp(testEnv, { pool: fixture.pool, tokenVerifier });

    try {
      const [res1, res2] = await Promise.all([
        request(runtime.app)
          .post(`/api/v1/orders/${orderId1}/confirm-received`)
          .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
          .send({}),
        request(runtime.app)
          .post(`/api/v1/orders/${orderId2}/confirm-received`)
          .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
          .send({}),
      ]);

      assert.equal(res1.status, 200);
      assert.equal(res2.status, 200);

      const buyer = fixture.getBuyer();
      assert.equal(buyer.total_spent, '5000000.00');
      assert.equal(buyer.buyer_tier, 'VIP');

      // Both orders processed under 5.0M threshold, so both enjoyed x1 (10 pts + 10 pts)
      // Initial 480 + 10 + 10 = 500 points!
      assert.equal(buyer.loyalty_points, 500);

      const ledger = fixture.getLedger();
      assert.equal(ledger.length, 2);
      assert.deepEqual(ledger.map(l => l.points_delta), [10, 10]);
    } finally {
      await runtime.close();
    }
  });

  it('Under 10.000đ order: creates ledger row with points_delta = 0 and increases total_spent', async () => {
    const fixture = createLoyaltyTestPool('100000.00', 10, 'STANDARD');
    const tokenVerifier = new StubTokenVerifier();

    const orderId = '33333333-0000-4000-8000-000000000001';
    fixture.addOrder({
      order_id: orderId,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '5000.00', // 5k VND < 10k VND
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '5000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    const runtime = createRuntimeApp(testEnv, { pool: fixture.pool, tokenVerifier });

    try {
      const res = await request(runtime.app)
        .post(`/api/v1/orders/${orderId}/confirm-received`)
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
        .send({});

      assert.equal(res.status, 200);

      const buyer = fixture.getBuyer();
      assert.equal(buyer.total_spent, '105000.00');
      assert.equal(buyer.loyalty_points, 10); // Unchanged

      const ledger = fixture.getLedger();
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].points_delta, 0);
      assert.equal(ledger[0].reference_order_id, orderId);
    } finally {
      await runtime.close();
    }
  });

  it('Direct database/loyalty test: duplicate order completion does not double-award points (ON CONFLICT check)', async () => {
    const fixture = createLoyaltyTestPool('200000.00', 20, 'STANDARD');
    const loyaltyService = new LoyaltyService(fixture.pool);

    const client = await fixture.pool.connect();
    try {
      await client.query('BEGIN');
      const firstResult = await loyaltyService.recordOrderCompleted(client, {
        order_id: 'order-dup-test-01',
        buyer_id: BUYER_ID,
        subtotal: '100000.00',
        discount_amount: '0.00',
      });
      await client.query('COMMIT');

      assert.equal(firstResult.inserted, true);
      assert.equal(firstResult.pointsDelta, 10);
      assert.equal(firstResult.newTotalSpent, '300000.00');

      let buyer = fixture.getBuyer();
      assert.equal(buyer.total_spent, '300000.00');
      assert.equal(buyer.loyalty_points, 30);

      // Now attempt duplicate execution directly with the same order
      await client.query('BEGIN');
      const secondResult = await loyaltyService.recordOrderCompleted(client, {
        order_id: 'order-dup-test-01',
        buyer_id: BUYER_ID,
        subtotal: '100000.00',
        discount_amount: '0.00',
      });
      await client.query('COMMIT');

      assert.equal(secondResult.inserted, false);
      assert.equal(secondResult.pointsDelta, 0);

      buyer = fixture.getBuyer();
      // Total spent and points must NOT have changed!
      assert.equal(buyer.total_spent, '300000.00');
      assert.equal(buyer.loyalty_points, 30);

      const ledger = fixture.getLedger();
      assert.equal(ledger.length, 1);
    } finally {
      client.release();
    }
  });

  it('API test: repeating confirm-received API call returns 409 and does not double-award points', async () => {
    const fixture = createLoyaltyTestPool('100000.00', 10, 'STANDARD');
    const tokenVerifier = new StubTokenVerifier();

    const orderId = '44444444-0000-4000-8000-000000000001';
    fixture.addOrder({
      order_id: orderId,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    const runtime = createRuntimeApp(testEnv, { pool: fixture.pool, tokenVerifier });

    try {
      const res1 = await request(runtime.app)
        .post(`/api/v1/orders/${orderId}/confirm-received`)
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
        .send({});
      assert.equal(res1.status, 200);

      // Repeat request
      const res2 = await request(runtime.app)
        .post(`/api/v1/orders/${orderId}/confirm-received`)
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
        .send({});
      assert.equal(res2.status, 409);

      const buyer = fixture.getBuyer();
      assert.equal(buyer.total_spent, '200000.00');
      assert.equal(buyer.loyalty_points, 20);
    } finally {
      await runtime.close();
    }
  });

  it('Buyer Loyalty API: GET /api/v1/buyer/loyalty and GET /api/v1/buyer/loyalty/history return valid envelope', async () => {
    const fixture = createLoyaltyTestPool('2500000.00', 250, 'STANDARD');
    const tokenVerifier = new StubTokenVerifier();

    const orderId = '55555555-0000-4000-8000-000000000001';
    fixture.addOrder({
      order_id: orderId,
      buyer_id: BUYER_ID,
      shop_id: SHOP_ID,
      recipient_name: 'Nguyen Van A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'Ben Nghe',
      delivery_address: '1 Le Duan',
      subtotal: '100000.00',
      discount_amount: '0.00',
      shipping_fee: '0.00',
      total_amount: '100000.00',
      status: 'SHIPPING',
      cancel_reason: null,
    });

    const runtime = createRuntimeApp(testEnv, { pool: fixture.pool, tokenVerifier });

    try {
      // First confirm order to have a ledger entry
      await request(runtime.app)
        .post(`/api/v1/orders/${orderId}/confirm-received`)
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`)
        .send({});

      // 1. Check loyalty status endpoint
      const resStatus = await request(runtime.app)
        .get('/api/v1/buyer/loyalty')
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`);

      assert.equal(resStatus.status, 200);
      assert.equal(resStatus.body.data.tier, 'STANDARD');
      assert.equal(resStatus.body.data.total_spent, '2600000.00');
      assert.equal(resStatus.body.data.loyalty_points, 260);
      assert.equal(resStatus.body.data.vip_threshold, '5000000.00');
      assert.equal(resStatus.body.data.points_multiplier, 1);
      assert.equal(resStatus.body.data.next_tier, 'VIP');

      // 2. Check loyalty history endpoint
      const resHistory = await request(runtime.app)
        .get('/api/v1/buyer/loyalty/history?page=1&limit=10')
        .set('Authorization', `Bearer stub-token-${BUYER_ID}`);

      assert.equal(resHistory.status, 200);
      assert.equal(resHistory.body.data.total, 1);
      assert.equal(resHistory.body.data.items.length, 1);
      assert.equal(resHistory.body.data.items[0].points_delta, 10);
      assert.equal(resHistory.body.data.items[0].reference_order_id, orderId);

      // 3. Unauthorized access check
      const resUnauth = await request(runtime.app).get('/api/v1/buyer/loyalty');
      assert.equal(resUnauth.status, 401);

      // 4. Role authorization check (Seller cannot call buyer loyalty)
      const resSeller = await request(runtime.app)
        .get('/api/v1/buyer/loyalty')
        .set('Authorization', `Bearer stub-token-${SELLER_ID}`);
      assert.equal(resSeller.status, 403);
    } finally {
      await runtime.close();
    }
  });
});
