import '../../src/platform/config/load-root-env.ts';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabasePool } from '../../db/client.ts';
import { loadDatabaseConfig } from '../../db/config.ts';
import { getRedisClient, closeRedisClient } from '../../src/modules/flash-sale/infrastructure/redis.client.ts';
import { FlashSaleService } from '../../src/modules/flash-sale/services/flash-sale.service.ts';
import { FlashSaleLuaCode } from '../../src/modules/flash-sale/domain/flash-sale.types.ts';
import { ensureAuthUser, createFixtureUser } from './fixtures/database-fixtures.ts';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';

describe('Feature 05: Flash Sale & Concurrency Inventory Engine', () => {
  let pool: Pool;
  let redis: Redis;
  let service: FlashSaleService;

  let testUserId: string;
  let testShopId: string;
  let testProductId: string;
  let testVariantId: string;
  let testSlotId: string;
  let testItemId: string;

  async function createBuyer(userId: string, email: string) {
    await ensureAuthUser(pool, userId, email);
    await createFixtureUser(pool, { userId, email, role: 'BUYER', status: 'ACTIVE' });
  }

  beforeAll(async () => {
    pool = createDatabasePool(loadDatabaseConfig(process.env));
    redis = getRedisClient();
    service = new FlashSaleService(pool, redis);

    // Bootstrap test fixtures in DB
    const buyerUserId = crypto.randomUUID();
    const buyerEmail = `test-buyer-${Date.now()}@flashsale.test`;
    await createBuyer(buyerUserId, buyerEmail);
    testUserId = buyerUserId;

    const sellerUserId = crypto.randomUUID();
    const sellerEmail = `test-seller-${Date.now()}@flashsale.test`;
    await ensureAuthUser(pool, sellerUserId, sellerEmail);
    await createFixtureUser(pool, { userId: sellerUserId, email: sellerEmail, role: 'SELLER', status: 'ACTIVE' });

    const shopRes = await pool.query(
      `INSERT INTO shops (shop_id, owner_id, shop_name, status)
       VALUES (gen_random_uuid(), $1, 'Flash Sale Official Shop', 'ACTIVE')
       ON CONFLICT (owner_id) DO UPDATE SET status = 'ACTIVE'
       RETURNING shop_id`,
      [sellerUserId]
    );
    testShopId = shopRes.rows[0].shop_id;

    const catRes = await pool.query(
      `INSERT INTO categories (category_id, category_name, status)
       VALUES (gen_random_uuid(), $1, 'ACTIVE')
       RETURNING category_id`,
      [`Flash Tech ${Date.now()}`]
    );
    const catId = catRes.rows[0].category_id;

    const prodRes = await pool.query(
      `INSERT INTO products (product_id, shop_id, category_id, product_name, status)
       VALUES (gen_random_uuid(), $1, $2, 'Dino Ultra Phone 16', 'ACTIVE')
       RETURNING product_id`,
      [testShopId, catId]
    );
    testProductId = prodRes.rows[0].product_id;

    const varRes = await pool.query(
      `INSERT INTO product_variants (variant_id, product_id, variant_name, sku, price, stock_quantity, status)
       VALUES (gen_random_uuid(), $1, '256GB Black', $2, 20000000, 500, 'ACTIVE')
       RETURNING variant_id`,
      [testProductId, `SKU-FS-${Date.now()}`]
    );
    testVariantId = varRes.rows[0].variant_id;

    // Tạo Flash Sale Session & Item
    testSlotId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Golden Hour 12h-15h', now() - interval '1 hour', now() + interval '2 hours', 'ACTIVE')`,
      [testSlotId]
    );

    testItemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 10)`,
      [testItemId, testSlotId, testProductId, testVariantId]
    );
  });

  afterAll(async () => {
    // Cleanup Redis keys
    const keys = await redis.keys('*flash_sale*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await pool.end();
  });

  it('1. Test Concurrency Kho: 50 requests đồng thời tranh mua 10 sản phẩm (Zero Overselling)', async () => {
    // Warm-up tồn kho lên Redis (10 món)
    await service.warmUpSlot(testSlotId);

    const initialStock = await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`);
    expect(Number(initialStock)).toBe(10);

    // Tạo 50 users giả lập gửi đồng thời trong cùng 1 tick
    const requests = Array.from({ length: 50 }).map(async (_, idx) => {
      const buyerId = crypto.randomUUID();
      const buyerEmail = `buyer-${idx}-${Date.now()}@flash.test`;
      await createBuyer(buyerId, buyerEmail);

      return service.purchase({
        idempotency_key: `idemp-concurrent-${idx}-${Date.now()}`,
        user_id: buyerId,
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: `Buyer ${idx}`,
        recipient_phone: '0901234567',
        province: 'TP.HCM',
        district: 'Q1',
        ward: 'Bến Nghé',
        delivery_address: '123 Đồng Khởi',
      });
    });

    const results = await Promise.all(requests);

    const successfulOrders = results.filter((r) => r.success);
    const failedOrders = results.filter((r) => !r.success);

    // KỲ VỌNG TUYỆT ĐỐI:
    // Đúng 10 đơn mua thành công
    expect(successfulOrders.length).toBe(10);
    // 40 đơn còn lại nhận thông báo hết hàng
    expect(failedOrders.length).toBe(40);

    // Tồn kho Redis dừng lại chính xác ở số 0, TUYỆT ĐỐI KHÔNG BỊ ÂM
    const finalRedisStock = Number(await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`));
    expect(finalRedisStock).toBe(0);

    // Đối soát số Order thực tế trong Database
    const dbOrdersCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM order_items WHERE variant_id = $1`,
      [testVariantId]
    );
    expect(dbOrdersCount.rows[0].count).toBe(10);
  });

  it('2. Test Concurrency Voucher: 2 users cùng bấm dùng 1 voucher chỉ còn 1 quota', async () => {
    const voucherCode = `FSVOUCHER-${Date.now()}`;
    const voucherId = crypto.randomUUID();

    // Tạo voucher trong DB và warm-up lên Redis với quota = 1
    await pool.query(
      `INSERT INTO vouchers (voucher_id, code, voucher_name, scope, discount_type, discount_value, min_order_value, quantity, start_at, end_at, status)
       VALUES ($1, $2, 'Flash 50K', 'PLATFORM', 'FIXED', 50000, 0, 1, now() - interval '1 hour', now() + interval '1 day', 'ACTIVE')`,
      [voucherId, voucherCode]
    );

    // Nạp lại stock cho sản phẩm
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);
    await redis.set(`voucher:quota:${testSlotId}:${voucherCode}`, 1);

    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    await createBuyer(userA, `ua-${Date.now()}@test.com`);
    await createBuyer(userB, `ub-${Date.now()}@test.com`);

    // Bắn đồng thời 2 request áp cùng voucher
    const [resA, resB] = await Promise.all([
      service.purchase({
        idempotency_key: `idemp-v-a-${Date.now()}`,
        user_id: userA,
        slot_id: testSlotId,
        item_id: testItemId,
        voucher_code: voucherCode,
        recipient_name: 'User A',
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Address A',
      }),
      service.purchase({
        idempotency_key: `idemp-v-b-${Date.now()}`,
        user_id: userB,
        slot_id: testSlotId,
        item_id: testItemId,
        voucher_code: voucherCode,
        recipient_name: 'User B',
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Address B',
      }),
    ]);

    const successes = [resA, resB].filter((r) => r.success);
    const fails = [resA, resB].filter((r) => !r.success);

    // Đúng 1 người được áp voucher thành công
    expect(successes.length).toBe(1);
    // 1 người còn lại bị từ chối vì hết lượt voucher
    expect(fails.length).toBe(1);
    expect(fails[0].code).toBe(FlashSaleLuaCode.VOUCHER_OUT_OF_STOCK);

    // Quota voucher trong Redis dừng ở 0 (không bị âm -1)
    const finalVoucherQuota = Number(await redis.get(`voucher:quota:${testSlotId}:${voucherCode}`));
    expect(finalVoucherQuota).toBe(0);
  });

  it('3. Test Idempotent Retry: Gửi lại cùng Idempotency-Key trả lại kết quả cũ (HTTP 200 Replay)', async () => {
    const idempKey = `idemp-replay-${Date.now()}`;
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    // Lần 1: Mua thành công
    const firstCall = await service.purchase({
      idempotency_key: idempKey,
      user_id: testUserId,
      slot_id: testSlotId,
      item_id: testItemId,
      recipient_name: 'Replay User',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Test Addr',
    });

    expect(firstCall.success).toBe(true);
    expect(firstCall.order_id).toBeDefined();

    // Lần 2: Client retry gửi lại đúng idempotency_key đó
    const secondCall = await service.purchase({
      idempotency_key: idempKey,
      user_id: testUserId,
      slot_id: testSlotId,
      item_id: testItemId,
      recipient_name: 'Replay User',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Test Addr',
    });

    // Trả về đúng kết quả cũ, is_replay = true, order_id trùng khớp 100%
    expect(secondCall.success).toBe(true);
    expect(secondCall.is_replay).toBe(true);
    expect(secondCall.order_id).toBe(firstCall.order_id);
  });

  it('4. Test Crash Recovery Trước Commit: Watchdog tự động hoàn kho khi không có Order trong Postgres', async () => {
    const orphanIdempKey = `idemp-orphan-${Date.now()}`;
    const testOrphanUser = crypto.randomUUID();
    await createBuyer(testOrphanUser, `orphan-${Date.now()}@test.com`);

    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);
    await redis.set(`flash_sale:lease:${orphanIdempKey}`, 'HOLD', 'EX', 600);

    // Giả lập server trừ Redis stock xuống 4 và crash trước khi ghi Postgres
    await redis.decr(`flash_sale:stock:${testSlotId}:${testItemId}`);
    const stockAfterCrash = Number(await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`));
    expect(stockAfterCrash).toBe(4);

    // Thêm vào Watchdog ZSet với timestamp quá hạn (40 giây trước)
    const overdueTimestamp = Date.now() - 40_000;
    const payload = JSON.stringify({
      idemp_key: orphanIdempKey,
      user_id: testOrphanUser,
      slot_id: testSlotId,
      item_id: testItemId,
      voucher_code: 'NONE',
      created_at: overdueTimestamp,
    });
    await redis.zadd('flash_sale:pending_reservations', overdueTimestamp, payload);

    // Kích hoạt Watchdog quét
    const sweepResult = await service.runWatchdogSweep();
    expect(sweepResult.compensated).toBeGreaterThanOrEqual(1);

    // Tồn kho Redis được tự động hoàn lại số 5
    const restoredStock = Number(await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`));
    expect(restoredStock).toBe(5);

    // Lease được đổi sang RECLAIMED
    const lease = await redis.get(`flash_sale:lease:${orphanIdempKey}`);
    expect(lease).toBe('RECLAIMED');
  });

  it('5. Test Crash Sau Commit: Watchdog phát hiện Order đã có trong Postgres -> Self-heal Replay Cache, KHÔNG hoàn kho', async () => {
    const postCommitIdempKey = `idemp-post-commit-${Date.now()}`;
    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `post-commit-${Date.now()}@test.com`);

    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);
    await redis.set(`flash_sale:lease:${postCommitIdempKey}`, 'HOLD', 'EX', 600);

    // Tạo sẵn 1 Order thực tế trong Postgres để giả lập việc commit đã thành công
    const realOrderId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO orders (order_id, buyer_id, shop_id, recipient_name, recipient_phone, province, district, ward, delivery_address, subtotal, total_amount, status, cancel_reason)
       VALUES ($1, $2, $3, 'Committed Buyer', '0901234567', 'HCM', 'Q1', 'BN', 'Addr', 999000, 999000, 'PENDING_CONFIRMATION', $4)`,
      [realOrderId, buyerId, testShopId, postCommitIdempKey]
    );

    // Giả lập bản ghi còn sót trong pending_reservations do server sập ngay trước ZREM
    const overdueTimestamp = Date.now() - 40_000;
    const payload = JSON.stringify({
      idemp_key: postCommitIdempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      voucher_code: 'NONE',
      created_at: overdueTimestamp,
    });
    await redis.zadd('flash_sale:pending_reservations', overdueTimestamp, payload);

    // Chạy Watchdog quét
    const sweepResult = await service.runWatchdogSweep();
    expect(sweepResult.selfHealed).toBeGreaterThanOrEqual(1);

    // BẢO ĐẢM TUYỆT ĐỐI: Không hoàn kho nhầm! Stock vẫn giữ nguyên = 5
    const stockAfterSweep = Number(await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`));
    expect(stockAfterSweep).toBe(5);

    // Lease được chuyển sang COMMITTED
    const lease = await redis.get(`flash_sale:lease:${postCommitIdempKey}`);
    expect(lease).toBe('COMMITTED');

    // Idempotency Replay Cache được khôi phục đúng với realOrderId
    const cachedIdemp = await redis.get(`flash_sale:idemp:${buyerId}:${postCommitIdempKey}`);
    expect(cachedIdemp).toBeDefined();
    const parsedCache = JSON.parse(cachedIdemp!);
    expect(parsedCache.order_id).toBe(realOrderId);
  });
});
