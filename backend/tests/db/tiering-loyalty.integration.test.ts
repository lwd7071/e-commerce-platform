import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadDatabaseConfig, parseRunRemoteDbTests } from '../../db/config.ts';
import { LoyaltyService } from '../../src/modules/loyalty/services/loyalty.service.ts';
import { PgCheckoutService } from '../../src/modules/checkout/services/pg-checkout.service.ts';
import type { RequestContext } from '../../src/contracts/request-context.contract.ts';
import { withTransaction } from '../../db/transaction.ts';
import {
  createFixtureUser,
  createFixtureShop,
  createFixtureCategory,
  createFixtureProduct,
  createFixtureVariant,
  createFixtureOrder,
  type FixtureOrder,
} from './fixtures/database-fixtures.ts';

const dbDescribe = parseRunRemoteDbTests(process.env) ? describe : describe.skip;

dbDescribe('Tiering & Loyalty Integration (Real PostgreSQL)', { timeout: 60_000, sequential: true }, () => {
  const schema = `p5_loyalty_${randomUUID().replaceAll('-', '')}`;
  let pool: pg.Pool;
  let loyaltyService: LoyaltyService;
  let buyerId: string;
  let sellerId: string;
  let shopId: string;
  let productId: string;
  let _variantId: string;

  async function runTx<T>(operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    return withTransaction(pool, async client => {
      await client.query(`SET search_path TO ${schema}, public`);
      return operation(client);
    });
  }

  async function createOrder(overrides: Partial<FixtureOrder> = {}): Promise<FixtureOrder> {
    return runTx(async client => createFixtureOrder(client, buyerId, shopId, overrides));
  }

  async function getUser(userId: string) {
    return runTx(async client => {
      const res = await client.query<{ total_spent: string; buyer_tier: string; loyalty_points: number }>(
        'SELECT total_spent, buyer_tier, loyalty_points FROM app_users WHERE user_id = $1',
        [userId],
      );
      return res.rows[0];
    });
  }

  async function getTxCount(orderId: string) {
    return runTx(async client => {
      const res = await client.query<{ count: string }>(
        'SELECT count(*) FROM loyalty_point_transactions WHERE reference_order_id = $1',
        [orderId],
      );
      return Number(res.rows[0].count);
    });
  }

  async function createShipment(orderId: string, status: 'SHIPPING' | 'DELIVERED' = 'SHIPPING') {
    return runTx(async client => {
      const shipmentId = randomUUID();
      await client.query(
        `INSERT INTO shipments (shipment_id, order_id, carrier_name, tracking_code, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [shipmentId, orderId, 'Express Courier', `TRK_${shipmentId.slice(0, 8)}`, status],
      );
      return { shipmentId, orderId, status };
    });
  }

  beforeAll(async () => {
    const config = loadDatabaseConfig(process.env);
    const directUrl = new URL(config.directUrl.toString());
    directUrl.searchParams.set('options', `-c search_path=${schema},public`);
    pool = new pg.Pool({
      connectionString: directUrl.toString(),
      max: 8,
      connectionTimeoutMillis: 15_000,
      options: `-c search_path=${schema},public -c statement_timeout=20000`,
      application_name: schema,
    });

    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`GRANT USAGE ON SCHEMA ${schema} TO anon, authenticated`);
    await pool.query(`SET search_path TO ${schema}, public`);
    await pool.query('CREATE TABLE fixture_auth_users (id uuid PRIMARY KEY)');

    const initial = await readFile(
      new URL('../../prisma/migrations/20260916110000_initial_schema/migration.sql', import.meta.url),
      'utf8',
    );
    await pool.query(
      initial
        .replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '')
        .replaceAll('auth.users', 'fixture_auth_users'),
    );

    const migrations = [
      '20260918170000_add_api_idempotency_records',
      '20260922120000_t2_performance_indexes',
      '20260924120000_t3_idempotency_rls_hardening',
      '20261003100000_shop_tiering',
      '20261003110000_buyer_loyalty',
      '20261003120000_secure_loyalty_ledger',
    ];

    for (const migration of migrations) {
      const sql = await readFile(
        new URL(`../../prisma/migrations/${migration}/migration.sql`, import.meta.url),
        'utf8',
      );
      await pool.query(sql);
    }

    loyaltyService = new LoyaltyService(pool);
  }, 90_000);

  afterAll(async () => {
    if (pool) {
      try {
        await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      } finally {
        await pool.end();
      }
    }
  }, 30_000);

  beforeEach(async () => {
    await runTx(async client => {
      await client.query('TRUNCATE fixture_auth_users, categories CASCADE');
      const bId = randomUUID();
      await client.query('INSERT INTO fixture_auth_users VALUES ($1)', [bId]);
      await createFixtureUser(client, { userId: bId, role: 'BUYER' });
      buyerId = bId;

      const sId = randomUUID();
      await client.query('INSERT INTO fixture_auth_users VALUES ($1)', [sId]);
      await createFixtureUser(client, { userId: sId, role: 'SELLER' });
      sellerId = sId;

      shopId = (await createFixtureShop(client, sellerId)).shopId;
      const category = await createFixtureCategory(client);
      productId = (await createFixtureProduct(client, shopId, category.categoryId)).productId;
      _variantId = (await createFixtureVariant(client, productId, { stockQuantity: 100 })).variantId;
    });
  }, 30_000);

  // =========================================================================
  // Suite 1: Schema Verification on Real PostgreSQL
  // =========================================================================
  describe('Schema & Security Verification', () => {
    it('verifies shops table has tier and override metadata columns', async () => {
      const res = await pool.query<{ column_name: string; column_default: string | null }>(
        `SELECT column_name, column_default FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = 'shops' 
         AND column_name IN ('tier', 'tier_override', 'tier_override_reason', 'tier_overridden_at', 'tier_override_by')`,
        [schema],
      );
      const cols = res.rows.map(r => r.column_name);
      expect(cols).toContain('tier');
      expect(cols).toContain('tier_override');
      expect(cols).toContain('tier_override_reason');
      expect(cols).toContain('tier_overridden_at');
      expect(cols).toContain('tier_override_by');

      const tierCol = res.rows.find(r => r.column_name === 'tier');
      expect(tierCol?.column_default).toContain('STANDARD');
    });

    it('verifies app_users table has buyer_tier, total_spent, and loyalty_points', async () => {
      const res = await pool.query<{ column_name: string; column_default: string | null }>(
        `SELECT column_name, column_default FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = 'app_users' 
         AND column_name IN ('buyer_tier', 'total_spent', 'loyalty_points')`,
        [schema],
      );
      const cols = res.rows.map(r => r.column_name);
      expect(cols).toContain('buyer_tier');
      expect(cols).toContain('total_spent');
      expect(cols).toContain('loyalty_points');

      const tierCol = res.rows.find(r => r.column_name === 'buyer_tier');
      expect(tierCol?.column_default).toContain('STANDARD');
    });

    it('verifies loyalty_point_transactions table, RLS, and unique partial index', async () => {
      const tableRes = await pool.query<{ relrowsecurity: boolean }>(
        `SELECT c.relrowsecurity FROM pg_class c 
         JOIN pg_namespace n ON n.oid = c.relnamespace 
         WHERE n.nspname = $1 AND c.relname = 'loyalty_point_transactions'`,
        [schema],
      );
      expect(tableRes.rows).toHaveLength(1);
      expect(tableRes.rows[0].relrowsecurity).toBe(true);

      const indexRes = await pool.query<{ indexname: string }>(
        `SELECT indexname FROM pg_indexes 
         WHERE schemaname = $1 AND tablename = 'loyalty_point_transactions' 
         AND indexname = 'uq_loyalty_transactions__order_earned'`,
        [schema],
      );
      expect(indexRes.rows).toHaveLength(1);
    });

    it('verifies explicit privilege denial: anon and authenticated are blocked, backend default user is permitted', async () => {
      // 1. Role anon: bị từ chối truy cập SELECT (SQLSTATE 42501)
      await expect(
        runTx(async client => {
          await client.query('SET ROLE anon');
          await client.query('SELECT count(*) FROM loyalty_point_transactions');
        }),
      ).rejects.toThrow(/permission denied/i);

      // 2. Role authenticated: bị từ chối truy cập SELECT (SQLSTATE 42501)
      await expect(
        runTx(async client => {
          await client.query('SET ROLE authenticated');
          await client.query('SELECT count(*) FROM loyalty_point_transactions');
        }),
      ).rejects.toThrow(/permission denied/i);

      // 3. Role anon: bị từ chối truy cập INSERT
      await expect(
        runTx(async client => {
          await client.query('SET ROLE anon');
          await client.query(
            "INSERT INTO loyalty_point_transactions (transaction_id, user_id, points_delta, reason) VALUES ($1, $2, 10, 'TEST')",
            [randomUUID(), buyerId],
          );
        }),
      ).rejects.toThrow(/permission denied/i);

      // 4. Backend (postgres / service role): truy cập đọc và ghi thành công
      await runTx(async client => {
        await client.query('RESET ROLE');
        const res = await client.query('SELECT count(*) FROM loyalty_point_transactions');
        expect(Number(res.rows[0].count)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // =========================================================================
  // Suite 2: Duplicate Prevention in Real PostgreSQL Transaction
  // =========================================================================
  describe('Duplicate Prevention & Idempotency', () => {
    it('records order completed and ignores duplicate execution via ON CONFLICT', async () => {
      const order = await createOrder({
        status: 'SHIPPING',
        subtotal: '200000.00',
        discountAmount: '0.00',
        shippingFee: '30000.00',
        totalAmount: '230000.00',
      });

      // Lần 1: Ghi nhận điểm và chi tiêu
      const result1 = await runTx(async client => {
        return loyaltyService.recordOrderCompleted(client, {
          order_id: order.orderId,
          buyer_id: buyerId,
          subtotal: order.subtotal,
          discount_amount: order.discountAmount,
        });
      });

      expect(result1.pointsDelta).toBe(20);
      expect(result1.newTier).toBe('STANDARD');
      expect(result1.newTotalSpent).toBe('200000.00');

      // Kiểm tra DB sau lần 1
      const userRes1 = await getUser(buyerId);
      expect(Number(userRes1.total_spent)).toBe(200000);
      expect(userRes1.loyalty_points).toBe(20);

      const txCount1 = await getTxCount(order.orderId);
      expect(txCount1).toBe(1);

      // Lần 2: Gọi lại cùng orderId (mô phỏng retry hoặc lặp hook)
      const result2 = await runTx(async client => {
        return loyaltyService.recordOrderCompleted(client, {
          order_id: order.orderId,
          buyer_id: buyerId,
          subtotal: order.subtotal,
          discount_amount: order.discountAmount,
        });
      });

      // Lần 2 bị ON CONFLICT chặn: pointsDelta = 0, điểm và chi tiêu không đổi
      expect(result2.pointsDelta).toBe(0);
      expect(result2.newTotalSpent).toBe('200000.00');

      const userRes2 = await getUser(buyerId);
      expect(Number(userRes2.total_spent)).toBe(200000);
      expect(userRes2.loyalty_points).toBe(20);

      const txCount2 = await getTxCount(order.orderId);
      expect(txCount2).toBe(1);
    });

    it('records sub-10.000đ order with 0 points while advancing total_spent and preventing duplicate', async () => {
      const order = await createOrder({
        status: 'SHIPPING',
        subtotal: '6000.00',
        discountAmount: '0.00',
        shippingFee: '15000.00',
        totalAmount: '21000.00',
      });

      const res = await runTx(async client => {
        return loyaltyService.recordOrderCompleted(client, {
          order_id: order.orderId,
          buyer_id: buyerId,
          subtotal: order.subtotal,
          discount_amount: order.discountAmount,
        });
      });

      expect(res.pointsDelta).toBe(0);
      expect(res.newTotalSpent).toBe('6000.00');

      const txRes = await runTx(async client => {
        return client.query<{ points_delta: number }>(
          'SELECT points_delta FROM loyalty_point_transactions WHERE reference_order_id = $1',
          [order.orderId],
        );
      });
      expect(txRes.rows).toHaveLength(1);
      expect(txRes.rows[0].points_delta).toBe(0);

      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(6000);
      expect(userRes.loyalty_points).toBe(0);
    });
  });

  // =========================================================================
  // Suite 3: Real PostgreSQL Concurrency under SELECT FOR UPDATE
  // =========================================================================
  describe('Concurrency & Lock Serialization (Real PostgreSQL)', () => {
    it('concurrency 4.9M: two concurrent 100k orders award x1 to first (10pts) and x2 to second (20pts), total 30pts', async () => {
      // Buyer bắt đầu ở 4.900.000 VNĐ (STANDARD)
      await runTx(async client => {
        await client.query(
          "UPDATE app_users SET total_spent = 4900000.00, buyer_tier = 'STANDARD', loyalty_points = 0 WHERE user_id = $1",
          [buyerId],
        );
      });

      const order1 = await createOrder({
        status: 'SHIPPING',
        subtotal: '100000.00',
        discountAmount: '0.00',
        shippingFee: '20000.00',
        totalAmount: '120000.00',
      });
      const order2 = await createOrder({
        status: 'SHIPPING',
        subtotal: '100000.00',
        discountAmount: '0.00',
        shippingFee: '20000.00',
        totalAmount: '120000.00',
      });

      // Thực thi đồng thời trên 2 kết nối pool độc lập
      const [res1, res2] = await Promise.all([
        runTx(async client => {
          return loyaltyService.recordOrderCompleted(client, {
            order_id: order1.orderId,
            buyer_id: buyerId,
            subtotal: order1.subtotal,
            discount_amount: order1.discountAmount,
          });
        }),
        runTx(async client => {
          return loyaltyService.recordOrderCompleted(client, {
            order_id: order2.orderId,
            buyer_id: buyerId,
            subtotal: order2.subtotal,
            discount_amount: order2.discountAmount,
          });
        }),
      ]);

      const points = [res1.pointsDelta, res2.pointsDelta].sort((a, b) => a - b);
      expect(points).toEqual([10, 20]);

      // Kiểm tra trạng thái cuối cùng trong database
      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(5100000);
      expect(userRes.buyer_tier).toBe('VIP');
      expect(userRes.loyalty_points).toBe(30);

      const txRes = await runTx(async client => {
        return client.query<{ count: string }>(
          "SELECT count(*) FROM loyalty_point_transactions WHERE user_id = $1 AND reason = 'ORDER_COMPLETED'",
          [buyerId],
        );
      });
      expect(Number(txRes.rows[0].count)).toBe(2);
    });

    it('concurrency 4.8M: two concurrent 100k orders both receive x1 (10pts each), reaching VIP after second', async () => {
      // Buyer bắt đầu ở 4.800.000 VNĐ (STANDARD)
      await runTx(async client => {
        await client.query(
          "UPDATE app_users SET total_spent = 4800000.00, buyer_tier = 'STANDARD', loyalty_points = 0 WHERE user_id = $1",
          [buyerId],
        );
      });

      const order1 = await createOrder({
        status: 'SHIPPING',
        subtotal: '100000.00',
        discountAmount: '0.00',
        shippingFee: '20000.00',
        totalAmount: '120000.00',
      });
      const order2 = await createOrder({
        status: 'SHIPPING',
        subtotal: '100000.00',
        discountAmount: '0.00',
        shippingFee: '20000.00',
        totalAmount: '120000.00',
      });

      const [res1, res2] = await Promise.all([
        runTx(async client => {
          return loyaltyService.recordOrderCompleted(client, {
            order_id: order1.orderId,
            buyer_id: buyerId,
            subtotal: order1.subtotal,
            discount_amount: order1.discountAmount,
          });
        }),
        runTx(async client => {
          return loyaltyService.recordOrderCompleted(client, {
            order_id: order2.orderId,
            buyer_id: buyerId,
            subtotal: order2.subtotal,
            discount_amount: order2.discountAmount,
          });
        }),
      ]);

      // Cả 2 đơn đều hưởng x1 (10 điểm mỗi đơn) vì khi lấy khóa, chi tiêu cũ là 4.8M và 4.9M (đều < 5M)
      expect(res1.pointsDelta).toBe(10);
      expect(res2.pointsDelta).toBe(10);

      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(5000000);
      expect(userRes.buyer_tier).toBe('VIP');
      expect(userRes.loyalty_points).toBe(20);
    });
  });

  // =========================================================================
  // Suite 4: Transaction Rollback Integrity
  // =========================================================================
  describe('Transaction Rollback Integrity', () => {
    it('rolls back ledger and points completely when a subsequent transaction step throws', async () => {
      const order = await createOrder({
        status: 'SHIPPING',
        subtotal: '150000.00',
        discountAmount: '0.00',
        shippingFee: '20000.00',
        totalAmount: '170000.00',
      });

      await expect(
        runTx(async client => {
          await loyaltyService.recordOrderCompleted(client, {
            order_id: order.orderId,
            buyer_id: buyerId,
            subtotal: order.subtotal,
            discount_amount: order.discountAmount,
          });
          throw new Error('Simulated failure during checkout completion');
        }),
      ).rejects.toThrow('Simulated failure during checkout completion');

      // Xác minh toàn bộ dữ liệu rollback sạch sẽ
      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(0);
      expect(userRes.loyalty_points).toBe(0);

      const count = await getTxCount(order.orderId);
      expect(count).toBe(0);
    });

    it('proves that a loyalty error during actual PgCheckoutService.confirmReceived rolls back Order, Shipment, ledger and buyer balances together', async () => {
      // 1. Tạo order ở trạng thái SHIPPING
      const order = await createOrder({
        status: 'SHIPPING',
        subtotal: '200000.00',
        discountAmount: '0.00',
        shippingFee: '30000.00',
        totalAmount: '230000.00',
      });

      // 2. Tạo shipment ở trạng thái SHIPPING
      const shipment = await createShipment(order.orderId, 'SHIPPING');

      // 3. Khởi tạo PgCheckoutService với LoyaltyService bị lỗi giả lập
      const failingLoyaltyService = {
        recordOrderCompleted: async () => {
          throw new Error('SIMULATED_LOYALTY_FAILURE: disk or ledger failure');
        },
      } as unknown as LoyaltyService;

      const failingCheckoutService = new PgCheckoutService(pool, undefined, failingLoyaltyService);

      const buyerContext: RequestContext = {
        request_id: randomUUID(),
        user_id: buyerId,
        role: 'BUYER',
      };

      // 4. Thực thi confirmReceived đi qua toàn bộ logic nghiệp vụ thực tế
      await expect(
        failingCheckoutService.confirmReceived(buyerContext, order.orderId),
      ).rejects.toThrow('SIMULATED_LOYALTY_FAILURE: disk or ledger failure');

      // 5. CHỨNG MINH TOÀN BỘ CÙNG ROLLBACK:
      // a. Order status vẫn giữ nguyên là SHIPPING (không thành COMPLETED)
      const orderRes = await runTx(async client => {
        const res = await client.query<{ status: string }>('SELECT status FROM orders WHERE order_id = $1', [order.orderId]);
        return res.rows[0];
      });
      expect(orderRes.status).toBe('SHIPPING');

      // b. Shipment status vẫn giữ nguyên là SHIPPING (không thành DELIVERED)
      const shipmentRes = await runTx(async client => {
        const res = await client.query<{ status: string }>('SELECT status FROM shipments WHERE shipment_id = $1', [shipment.shipmentId]);
        return res.rows[0];
      });
      expect(shipmentRes.status).toBe('SHIPPING');

      // c. app_users: total_spent và loyalty_points không bị cộng dồn
      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(0);
      expect(userRes.loyalty_points).toBe(0);

      // d. loyalty_point_transactions: không có bản ghi nào
      const txCount = await getTxCount(order.orderId);
      expect(txCount).toBe(0);

      // e. order_status_history: không có bản ghi chuyển sang COMPLETED
      const historyRes = await runTx(async client => {
        const res = await client.query<{ count: string }>(
          "SELECT count(*) FROM order_status_history WHERE order_id = $1 AND new_status = 'COMPLETED'",
          [order.orderId],
        );
        return Number(res.rows[0].count);
      });
      expect(historyRes).toBe(0);
    });

    it('verifies successful PgCheckoutService.confirmReceived commits Order, Shipment, ledger and balances atomically', async () => {
      // 1. Tạo order và shipment ở trạng thái SHIPPING
      const order = await createOrder({
        status: 'SHIPPING',
        subtotal: '250000.00',
        discountAmount: '0.00',
        shippingFee: '25000.00',
        totalAmount: '275000.00',
      });
      const shipment = await createShipment(order.orderId, 'SHIPPING');

      // 2. Dùng PgCheckoutService thật với real LoyaltyService
      const liveCheckoutService = new PgCheckoutService(pool, undefined, loyaltyService);
      const buyerContext: RequestContext = {
        request_id: randomUUID(),
        user_id: buyerId,
        role: 'BUYER',
      };

      // 3. Thực thi hoàn tất đơn hàng
      await liveCheckoutService.confirmReceived(buyerContext, order.orderId);

      // 4. CHỨNG MINH TOÀN BỘ CÙNG ĐƯỢC COMMIT ATOMIC:
      // a. Order status chuyển thành COMPLETED
      const orderRes = await runTx(async client => {
        const res = await client.query<{ status: string }>('SELECT status FROM orders WHERE order_id = $1', [order.orderId]);
        return res.rows[0];
      });
      expect(orderRes.status).toBe('COMPLETED');

      // b. Shipment status chuyển thành DELIVERED
      const shipmentRes = await runTx(async client => {
        const res = await client.query<{ status: string }>('SELECT status FROM shipments WHERE shipment_id = $1', [shipment.shipmentId]);
        return res.rows[0];
      });
      expect(shipmentRes.status).toBe('DELIVERED');

      // c. app_users: total_spent cập nhật 250k, loyalty_points nhận 25 điểm
      const userRes = await getUser(buyerId);
      expect(Number(userRes.total_spent)).toBe(250000);
      expect(userRes.loyalty_points).toBe(25);

      // d. loyalty_point_transactions: 1 bản ghi ORDER_COMPLETED
      const txCount = await getTxCount(order.orderId);
      expect(txCount).toBe(1);

      // e. order_status_history: có bản ghi COMPLETED
      const historyRes = await runTx(async client => {
        const res = await client.query<{ count: string }>(
          "SELECT count(*) FROM order_status_history WHERE order_id = $1 AND new_status = 'COMPLETED'",
          [order.orderId],
        );
        return Number(res.rows[0].count);
      });
      expect(historyRes).toBe(1);
    });
  });
});
