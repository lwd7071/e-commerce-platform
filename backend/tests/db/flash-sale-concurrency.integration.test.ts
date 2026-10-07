import '../../src/platform/config/load-root-env.ts';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
    await closeRedisClient();
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
  }, 30_000);

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
  }, 30_000);

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

  it('6. Test Time Window: Chặn mua khi Khung Giờ chưa bắt đầu (Slot Upcoming)', async () => {
    const upcomingSlotId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Upcoming Golden Hour', now() + interval '1 hour', now() + interval '3 hours', 'UPCOMING')`,
      [upcomingSlotId]
    );

    const upcomingItemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 10)`,
      [upcomingItemId, upcomingSlotId, testProductId, testVariantId]
    );

    await service.warmUpSlot(upcomingSlotId);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `upcoming-buyer-${Date.now()}@test.com`);

    const result = await service.purchase({
      idempotency_key: `idemp-upcoming-${Date.now()}`,
      user_id: buyerId,
      slot_id: upcomingSlotId,
      item_id: upcomingItemId,
      recipient_name: 'Upcoming Buyer',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe(FlashSaleLuaCode.SLOT_NOT_ACTIVE);

    // Kiểm tra không có đơn nào được tạo trong DB
    const orderCheck = await pool.query(
      `SELECT COUNT(*)::int as count FROM orders WHERE buyer_id = $1`,
      [buyerId]
    );
    expect(orderCheck.rows[0].count).toBe(0);
  });

  it('7. Test Time Window: Chặn mua khi Khung Giờ đã kết thúc (Slot Ended)', async () => {
    const endedSlotId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Ended Golden Hour', now() - interval '3 hours', now() - interval '1 hour', 'ENDED')`,
      [endedSlotId]
    );

    const endedItemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 10)`,
      [endedItemId, endedSlotId, testProductId, testVariantId]
    );

    await service.warmUpSlot(endedSlotId);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `ended-buyer-${Date.now()}@test.com`);

    const result = await service.purchase({
      idempotency_key: `idemp-ended-${Date.now()}`,
      user_id: buyerId,
      slot_id: endedSlotId,
      item_id: endedItemId,
      recipient_name: 'Ended Buyer',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe(FlashSaleLuaCode.SLOT_NOT_ACTIVE);
  });

  it('7b. Test Time Window: Slot bắt đầu ACTIVE, warm-up đúng TTL, trôi qua end_time -> Chặn mua SLOT_NOT_ACTIVE', async () => {
    const slotId = crypto.randomUUID();
    const now = Date.now();
    const startTimeIso = new Date(now - 10000).toISOString();
    const endTimeIso = new Date(now + 1500).toISOString();

    // Dùng cùng nguồn thời gian local để tránh clock skew giữa Cloud DB (Supabase) và local node
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Expiring Slot', $2, $3, 'ACTIVE')`,
      [slotId, startTimeIso, endTimeIso]
    );

    const itemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 10)`,
      [itemId, slotId, testProductId, testVariantId]
    );

    // Warm-up slot đúng TTL
    await service.warmUpSlot(slotId);

    // Chờ 2.5 giây để trôi qua end_time
    await new Promise((resolve) => setTimeout(resolve, 2500));

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `expiring-buyer-${Date.now()}@test.com`);

    const result = await service.purchase({
      idempotency_key: `idemp-expiring-${Date.now()}`,
      user_id: buyerId,
      slot_id: slotId,
      item_id: itemId,
      recipient_name: 'Expiring Buyer',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe(FlashSaleLuaCode.SLOT_NOT_ACTIVE);
  }, 10_000);

  it('7c. Test Time Window: Slot đang mở bán nhưng Admin hủy sớm (set ENDED) -> Chặn mua ngay lập tức', async () => {
    const slotId = crypto.randomUUID();
    // Tạo slot ACTIVE kết thúc sau 2 giờ (dùng server clock)
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Early Cancel Slot', now() - interval '10 minutes', now() + interval '2 hours', 'ACTIVE')`,
      [slotId]
    );

    const itemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 10)`,
      [itemId, slotId, testProductId, testVariantId]
    );

    await service.warmUpSlot(slotId);

    // Admin can thiệp hủy sớm phiên Flash Sale
    await pool.query('UPDATE flash_sale_sessions SET status = $1 WHERE slot_id = $2', ['ENDED', slotId]);
    await redis.set(`flash_sale:slot_status:${slotId}`, 'ENDED');

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `early-cancel-buyer-${Date.now()}@test.com`);

    const result = await service.purchase({
      idempotency_key: `idemp-early-cancel-${Date.now()}`,
      user_id: buyerId,
      slot_id: slotId,
      item_id: itemId,
      recipient_name: 'Early Cancel Buyer',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe(FlashSaleLuaCode.SLOT_NOT_ACTIVE);
  }, 10_000);

  it('8a. Test User Limit: Cùng 1 User gửi 20 requests với 20 idempotency_key khác nhau -> Chỉ đúng 1 thành công', async () => {
    // Nạp lại stock = 10 cho testItemId
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 10);

    const spamUserId = crypto.randomUUID();
    await createBuyer(spamUserId, `spam-user-${Date.now()}@test.com`);

    // Bắn 20 requests đồng thời với 20 key khác nhau
    const requests = Array.from({ length: 20 }).map((_, idx) =>
      service.purchase({
        idempotency_key: `idemp-diff-key-${idx}-${Date.now()}`,
        user_id: spamUserId,
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: 'Spam Buyer',
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
      })
    );

    const results = await Promise.all(requests);
    const successes = results.filter((r) => r.success);
    const fails = results.filter((r) => !r.success);

    // Duy nhất 1 đơn thành công
    expect(successes.length).toBe(1);
    // 19 đơn bị chặn do user đã mua trong slot này
    expect(fails.length).toBe(19);
    expect(fails.every((f) => f.code === FlashSaleLuaCode.USER_PURCHASE_LIMIT_EXCEEDED)).toBe(true);

    // Tồn kho chỉ bị trừ 1
    const currentStock = Number(await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`));
    expect(currentStock).toBe(9);

    // DB chỉ có đúng 1 order của user này
    const dbOrder = await pool.query(
      `SELECT COUNT(*)::int as count FROM orders WHERE buyer_id = $1`,
      [spamUserId]
    );
    expect(dbOrder.rows[0].count).toBe(1);
  });

  it('8b. Test Idempotency Concurrency: Cùng 1 User gửi 20 requests với CÙNG 1 idempotency_key -> Replay an toàn', async () => {
    const dblClickUserId = crypto.randomUUID();
    await createBuyer(dblClickUserId, `dblclick-user-${Date.now()}@test.com`);

    const sharedIdempKey = `idemp-shared-${Date.now()}`;
    // Bắn 20 requests đồng thời mang cùng 1 key
    const requests = Array.from({ length: 20 }).map(() =>
      service.purchase({
        idempotency_key: sharedIdempKey,
        user_id: dblClickUserId,
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: 'DblClick Buyer',
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
      })
    );

    const results = await Promise.all(requests);
    // Đúng 1 request giành được lock và thành công
    const successes = results.filter((r) => r.success);
    expect(successes.length).toBe(1);

    // 19 requests còn lại nhận thông báo đang xử lý (in-progress lock)
    const inProgress = results.filter((r) => !r.success);
    expect(inProgress.length).toBe(19);

    // Khi client retry gửi lại sau khi request đầu đã commit xong:
    const retryRes = await service.purchase({
      idempotency_key: sharedIdempKey,
      user_id: dblClickUserId,
      slot_id: testSlotId,
      item_id: testItemId,
      recipient_name: 'DblClick Buyer',
      recipient_phone: '0901234567',
      province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
    });

    expect(retryRes.success).toBe(true);
    expect(retryRes.is_replay).toBe(true);
    expect(retryRes.order_id).toBe(successes[0].order_id);

    // Trong DB chỉ có đúng 1 Order duy nhất
    const dbCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM orders WHERE buyer_id = $1`,
      [dblClickUserId]
    );
    expect(dbCount.rows[0].count).toBe(1);
  });

  it('9. Test Zero Stock Fast-Reject: Kho = 0 thì 50 requests bị chặn 100% tại Redis, DB calls = 0', async () => {
    await service.warmUpSlot(testSlotId);
    // Ép tồn kho về 0
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 0);

    // Gắn spy vào pool.connect (kết nối mở transaction dưới DB)
    const connectSpy = vi.spyOn(pool, 'connect');
    // Clear mock ngay trước khi bắn để loại bỏ mọi noise từ các test trước
    connectSpy.mockClear();

    // Dùng danh sách user_id ngẫu nhiên (không gọi createBuyer để tránh connect vào DB tạo fixture)
    const requests = Array.from({ length: 50 }).map((_, idx) =>
      service.purchase({
        idempotency_key: `idemp-zero-${idx}-${Date.now()}`,
        user_id: crypto.randomUUID(),
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: `Zero Buyer ${idx}`,
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
      })
    );

    const results = await Promise.all(requests);

    // 100% (50/50) requests thất bại vì hết hàng
    expect(results.every((r) => !r.success)).toBe(true);
    expect(results.every((r) => r.code === FlashSaleLuaCode.PRODUCT_OUT_OF_STOCK)).toBe(true);

    // BẰNG CHỨNG TRỰC TIẾP: Hoàn toàn không gọi pool.connect() để mở transaction DB
    expect(connectSpy).not.toHaveBeenCalled();

    connectSpy.mockRestore();
  });

  it('10. Test Reconciliation Job: Phát hiện sai lệch (Negative Path) và Xác nhận khớp (Happy Path)', async () => {
    const recSlotId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Reconcile Golden Hour', now() - interval '1 hour', now() + interval '2 hours', 'ACTIVE')`,
      [recSlotId]
    );

    // Tạo riêng 1 variant mới để tránh bị trùng order_items từ các test trước
    const varRes = await pool.query(
      `INSERT INTO product_variants (variant_id, product_id, variant_name, sku, price, stock_quantity, status)
       VALUES (gen_random_uuid(), $1, 'Rec Variant', $2, 20000000, 500, 'ACTIVE')
       RETURNING variant_id`,
      [testProductId, `SKU-REC-${Date.now()}`]
    );
    const recVariantId = varRes.rows[0].variant_id;

    const recItemId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, 5)`,
      [recItemId, recSlotId, testProductId, recVariantId]
    );

    await service.warmUpSlot(recSlotId);

    // 1. Mua thành công 2 món
    for (let i = 0; i < 2; i++) {
      const buyerId = crypto.randomUUID();
      await createBuyer(buyerId, `rec-buyer-${i}-${Date.now()}@test.com`);
      const res = await service.purchase({
        idempotency_key: `idemp-rec-${i}-${Date.now()}`,
        user_id: buyerId,
        slot_id: recSlotId,
        item_id: recItemId,
        recipient_name: `Rec Buyer ${i}`,
        recipient_phone: '0901234567',
        province: 'HCM', district: 'Q1', ward: 'BN', delivery_address: 'Addr',
      });
      expect(res.success).toBe(true);
    }

    // Nhánh 1: Happy Path - Khớp 100% (2 đã bán, tồn kho Redis = 3, tổng = 5)
    const happyReport = await service.reconcileSlot(recSlotId);
    expect(happyReport.is_balanced).toBe(true);
    expect(happyReport.discrepancy).toBe(0);

    // Nhánh 2: Negative Path - Cố tình can thiệp sửa trực tiếp Redis stock = 999 (gây sai lệch tồn kho)
    await redis.set(`flash_sale:stock:${recSlotId}:${recItemId}`, 999);

    const negativeReport = await service.reconcileSlot(recSlotId);
    // Phải phát hiện ra sai lệch!
    expect(negativeReport.is_balanced).toBe(false);
    expect(negativeReport.discrepancy).not.toBe(0);
  }, 30_000);

  it('10b. Test Auto-Balance: Khôi phục Redis stock khi lệch và ghi Two-Phase log APPLIED', async () => {
    // 1. Tạo một Admin user trong DB để làm operator cho Worker / Reconciler
    const adminId = crypto.randomUUID();
    const adminEmail = `admin-reconciler-${Date.now()}@test.com`;
    await ensureAuthUser(pool, adminId, adminEmail);
    await createFixtureUser(pool, { userId: adminId, email: adminEmail, role: 'ADMIN', status: 'ACTIVE' });

    // 2. Tạo một slot đã kết thúc (status = 'ENDED')
    const recSlotId = crypto.randomUUID();
    const now = Date.now();
    const startTimeIso = new Date(now - 7200000).toISOString();
    const endTimeIso = new Date(now - 3600000).toISOString();

    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Ended Slot Reconcile', $2, $3, 'ENDED')`,
      [recSlotId, startTimeIso, endTimeIso]
    );

    const varRes = await pool.query(
      `INSERT INTO product_variants (variant_id, product_id, variant_name, sku, price, stock_quantity, status)
       VALUES (gen_random_uuid(), $1, 'Rec Variant 10b', $2, 20000000, 500, 'ACTIVE')
       RETURNING variant_id`,
      [testProductId, `SKU-REC-10b-${Date.now()}`]
    );
    const recVariantId = varRes.rows[0].variant_id;

    const recItemId = crypto.randomUUID();
    const allocatedStock = 10;
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 20000000, 999000, $5)`,
      [recItemId, recSlotId, testProductId, recVariantId, allocatedStock]
    );

    // 3. Tạo 2 orders thật trong Postgres nằm trong khung giờ của slot
    const buyer1Id = crypto.randomUUID();
    await createBuyer(buyer1Id, `rec10b-buyer-1-${Date.now()}@test.com`);
    const order1Id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO orders (order_id, buyer_id, shop_id, recipient_name, recipient_phone, province, district, ward, delivery_address, subtotal, discount_amount, shipping_fee, total_amount, status, created_at)
       VALUES ($1, $2, $3, 'B1', '0901234567', 'HCM', 'Q1', 'BN', 'Addr', 999000, 0, 0, 999000, 'PENDING_CONFIRMATION', $4::timestamptz)`,
      [order1Id, buyer1Id, testShopId, new Date(now - 5000000).toISOString()]
    );
    await pool.query(
      `INSERT INTO order_items (order_item_id, order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, unit_price, quantity, line_total)
       VALUES ($1, $2, $3, $4, 'P1', 'V1', 999000, 1, 999000)`,
      [crypto.randomUUID(), order1Id, testProductId, recVariantId]
    );

    const buyer2Id = crypto.randomUUID();
    await createBuyer(buyer2Id, `rec10b-buyer-2-${Date.now()}@test.com`);
    const order2Id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO orders (order_id, buyer_id, shop_id, recipient_name, recipient_phone, province, district, ward, delivery_address, subtotal, discount_amount, shipping_fee, total_amount, status, created_at)
       VALUES ($1, $2, $3, 'B2', '0901234567', 'HCM', 'Q1', 'BN', 'Addr', 999000, 0, 0, 999000, 'CONFIRMED', $4::timestamptz)`,
      [order2Id, buyer2Id, testShopId, new Date(now - 4000000).toISOString()]
    );
    await pool.query(
      `INSERT INTO order_items (order_item_id, order_id, product_id, variant_id, product_name_snapshot, variant_snapshot, unit_price, quantity, line_total)
       VALUES ($1, $2, $3, $4, 'P1', 'V1', 999000, 1, 999000)`,
      [crypto.randomUUID(), order2Id, testProductId, recVariantId]
    );

    // 4. Cố tình set sai lệch trên Redis: ví dụ stock = 999
    await redis.set(`flash_sale:stock:${recSlotId}:${recItemId}`, 999);

    // Kiểm tra trước: read-only report thấy có sai lệch
    const reportBefore = await service.reconcileSlot(recSlotId);
    expect(reportBefore.is_balanced).toBe(false);
    expect(reportBefore.discrepancy).not.toBe(0);

    // 5. Kích hoạt autoBalance: true với operatorUserId của Admin
    const balanceReport = await service.reconcileSlot(recSlotId, { autoBalance: true, operatorUserId: adminId });
    expect(balanceReport.is_balanced).toBe(true);
    expect(balanceReport.discrepancy).toBe(0);

    // 6. Assert 1: Redis stock được khôi phục chính xác về allocated_stock - 2 = 8
    const redisStock = await redis.get(`flash_sale:stock:${recSlotId}:${recItemId}`);
    expect(Number(redisStock)).toBe(allocatedStock - 2);

    // 7. Assert 2: Bản ghi Two-Phase Audit log chuyển sang APPLIED
    const latestLogRes = await pool.query(
      `SELECT compensation_id, slot_id, item_id, user_id, status
       FROM flash_sale_compensation_logs
       WHERE slot_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [recSlotId]
    );
    expect(latestLogRes.rows.length).toBe(1);
    expect(latestLogRes.rows[0].status).toBe('APPLIED');
    expect(latestLogRes.rows[0].user_id).toBe(adminId);

    // 8. Assert 3: Gọi lại reconcileSlot lần 2 (read-only) thấy vẫn balanced
    const reportAfter = await service.reconcileSlot(recSlotId);
    expect(reportAfter.is_balanced).toBe(true);
    expect(reportAfter.discrepancy).toBe(0);
  }, 30_000);

  it('T1. Test Order Invariants: Đơn mới có cancel_reason = NULL, order_status_history, payments và voucher_usages đầy đủ', async () => {
    await service.warmUpSlot(testSlotId);

    const voucherCode = `INVARIANT-VOUCHER-${Date.now()}`;
    const voucherId = crypto.randomUUID();
    const discountVal = 50000;

    // 1. Tạo voucher hợp lệ trong DB và Redis
    await pool.query(
      `INSERT INTO vouchers (voucher_id, code, voucher_name, scope, discount_type, discount_value, min_order_value, quantity, start_at, end_at, status)
       VALUES ($1, $2, 'Invariant Voucher', 'PLATFORM', 'FIXED', $3, 0, 5, now() - interval '1 hour', now() + interval '1 day', 'ACTIVE')`,
      [voucherId, voucherCode, discountVal]
    );

    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);
    await redis.set(`voucher:quota:${testSlotId}:${voucherCode}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-inv-${Date.now()}@test.com`);
    const idempKey = `idemp-inv-${Date.now()}-12345678`;

    // 2. Mua hàng thành công
    const result = await service.purchase({
      idempotency_key: idempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      voucher_code: voucherCode,
      recipient_name: 'Nguyen Van Invariant',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'BN',
      delivery_address: '123 Le Loi',
    });

    expect(result.success).toBe(true);
    const orderId = result.order_id!;

    // 3. Assert 1: orders.cancel_reason BẮT BUỘC LÀ NULL (không lưu lậu idempotency_key tại đây)
    const orderRes = await pool.query('SELECT * FROM orders WHERE order_id = $1', [orderId]);
    expect(orderRes.rows.length).toBe(1);
    expect(orderRes.rows[0].cancel_reason).toBeNull();
    expect(orderRes.rows[0].status).toBe('PENDING_CONFIRMATION');
    const totalAmount = Number(orderRes.rows[0].total_amount);

    // 4. Assert 2: order_status_history BẮT BUỘC CÓ 1 dòng ban đầu
    const historyRes = await pool.query('SELECT * FROM order_status_history WHERE order_id = $1', [orderId]);
    expect(historyRes.rows.length).toBe(1);
    expect(historyRes.rows[0].old_status).toBeNull();
    expect(historyRes.rows[0].new_status).toBe('PENDING_CONFIRMATION');
    expect(historyRes.rows[0].changed_by).toBe(buyerId);
    expect(historyRes.rows[0].reason).toBe('FLASH_SALE_PURCHASE');

    // 5. Assert 3: payments BẮT BUỘC CÓ 1 dòng ban đầu PENDING
    const paymentRes = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    expect(paymentRes.rows.length).toBe(1);
    expect(paymentRes.rows[0].status).toBe('PENDING');
    expect(paymentRes.rows[0].method).toBe('ONLINE');
    expect(Number(paymentRes.rows[0].amount)).toBe(totalAmount);

    // 6. Assert 4: voucher_usages BẮT BUỘC CÓ 1 dòng liên kết
    const usageRes = await pool.query('SELECT * FROM voucher_usages WHERE order_id = $1', [orderId]);
    expect(usageRes.rows.length).toBe(1);
    expect(usageRes.rows[0].voucher_id).toBe(voucherId);
    expect(usageRes.rows[0].buyer_id).toBe(buyerId);
    expect(Number(usageRes.rows[0].discount_amount)).toBe(Number(orderRes.rows[0].discount_amount));
  }, 30_000);

  it('T3. Test Voucher Business Validity: Voucher hết hạn / sai shop / không đủ min order bị từ chối và hoàn quota Redis', async () => {
    await service.warmUpSlot(testSlotId);
    // 1. Tạo voucher hết hạn trong DB
    const expiredCode = `EXPIRED-${Date.now()}`;
    const expiredId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO vouchers (voucher_id, code, voucher_name, scope, discount_type, discount_value, min_order_value, quantity, start_at, end_at, status)
       VALUES ($1, $2, 'Expired Voucher', 'PLATFORM', 'FIXED', 50000, 0, 5, now() - interval '2 days', now() - interval '1 hour', 'ACTIVE')`,
      [expiredId, expiredCode]
    );

    // Nạp quota Redis
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);
    await redis.set(`voucher:quota:${testSlotId}:${expiredCode}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-exp-${Date.now()}@test.com`);
    const idempKey = `idemp-exp-${Date.now()}-12345678`;

    // 2. Mua hàng với voucher hết hạn
    const result = await service.purchase({
      idempotency_key: idempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      voucher_code: expiredCode,
      recipient_name: 'Nguyen Van Expired',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'BN',
      delivery_address: '123 Le Loi',
    });

    expect(result.success).toBe(true);
    const orderId = result.order_id!;

    // 3. Assert: Không được áp dụng giảm giá vì voucher hết hạn trong DB
    const orderRes = await pool.query('SELECT discount_amount FROM orders WHERE order_id = $1', [orderId]);
    expect(Number(orderRes.rows[0].discount_amount)).toBe(0);

    // 4. Assert: Không có bản ghi voucher_usages
    const usageRes = await pool.query('SELECT * FROM voucher_usages WHERE order_id = $1', [orderId]);
    expect(usageRes.rows.length).toBe(0);

    // 5. Assert: Quota voucher trên Redis được bồi hoàn trả lại (+1) về 5
    const quota = await redis.get(`voucher:quota:${testSlotId}:${expiredCode}`);
    expect(Number(quota)).toBe(5);
  }, 30_000);

  it('T2. Test Idempotency Conflict & Canonical Fingerprint: Cùng key khác payload trả 409 IDEMPOTENCY_KEY_REUSED', async () => {
    await service.warmUpSlot(testSlotId);
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-idemp-${Date.now()}@test.com`);
    const idempKey = `idemp-conflict-${Date.now()}-12345678`;

    // 1. Mua lần 1 với payload A
    const resA = await service.purchase({
      idempotency_key: idempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      recipient_name: 'Khach Hang A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'BN',
      delivery_address: '123 Le Loi',
    });
    expect(resA.success).toBe(true);

    // 2. Mua lần 2 với CÙNG key, CÙNG buyer nhưng KHÁC payload (đổi địa chỉ/SĐT)
    await expect(
      service.purchase({
        idempotency_key: idempKey,
        user_id: buyerId,
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: 'Khach Hang B', // Khác
        recipient_phone: '0988888888', // Khác
        province: 'Ha Noi', // Khác
        district: 'HK',
        ward: 'Hang Bac',
        delivery_address: '456 Trang Tien',
      })
    ).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
      httpStatus: 409,
    });

    // 3. Mua lần 3 với CÙNG key, CÙNG payload ban đầu -> Replay kết quả 200 OK
    const resReplay = await service.purchase({
      idempotency_key: idempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      recipient_name: 'Khach Hang A',
      recipient_phone: '0901234567',
      province: 'HCM',
      district: 'Q1',
      ward: 'BN',
      delivery_address: '123 Le Loi',
    });
    expect(resReplay.success).toBe(true);
    expect(resReplay.order_id).toBe(resA.order_id);
  }, 30_000);

  it('T4. Test Watchdog vs Slow Transaction Race: DB bị chậm, Watchdog sweep reclaim trước -> Pre-commit Lua trả về 0 -> DB Transaction ROLLBACK', async () => {
    await service.warmUpSlot(testSlotId);
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-t4-${Date.now()}@test.com`);
    const idempKey = `idemp-t4-${Date.now()}-12345678`;

    // Giả lập Watchdog sweep đã reclaim lease trước khi commit bằng cách set lease sang RECLAIMED
    // Để kiểm tra FLASH_SALE_PRE_COMMIT_LUA:
    const leaseKey = `flash_sale:lease:${idempKey}`;
    await redis.set(leaseKey, 'RECLAIMED', 'EX', 86400);

    // Khi purchase cố gắng commit, nó thấy lease đã bị RECLAIMED -> Bắt buộc ném TRANSACTION_LEASE_EXPIRED và ROLLBACK
    // (Ta mô phỏng bằng cách chạy trực tiếp Lua pre-commit)
    const { FLASH_SALE_PRE_COMMIT_LUA } = await import('../../src/modules/flash-sale/infrastructure/lua/flash-sale-pre-commit.lua.ts');
    const preCommitRes = await redis.eval(
      FLASH_SALE_PRE_COMMIT_LUA,
      1,
      leaseKey,
      Date.now().toString()
    );
    expect(Number(preCommitRes)).toBe(0); // Bị chặn!
  }, 30_000);

  it('T5. Test COMMIT Failure After Pre-Commit: Pre-commit set COMMITTING, nhưng COMMIT ném lỗi -> Catch block FORCE reclaim -> Kho được hoàn trả +1, lease thành RECLAIMED', async () => {
    await service.warmUpSlot(testSlotId);
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-t5-${Date.now()}@test.com`);
    const idempKey = `idemp-t5-${Date.now()}-12345678`;

    // Hook pool.connect cho purchase(): không làm ảnh hưởng pool.query
    const originalConnect = pool.connect.bind(pool);
    pool.connect = ((cb?: unknown) => {
      if (typeof cb === 'function') {
        return Reflect.apply(originalConnect, pool, [cb]);
      }
      return originalConnect().then((client) => {
        const origQuery = client.query;
        const origRelease = client.release;
        (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
          const query = args[0];
          const sql = typeof query === 'string'
            ? query
            : typeof query === 'object' && query !== null && 'text' in query && typeof query.text === 'string'
              ? query.text
              : '';
          if (sql.trim().toUpperCase() === 'COMMIT') {
            return Promise.reject(new Error('deadlock detected (simulated DB failure during COMMIT)'));
          }
          return Reflect.apply(origQuery, client, args);
        };
        (client as unknown as { release: (...args: unknown[]) => unknown }).release = (...args: unknown[]) => {
          (client as unknown as { query: typeof origQuery }).query = origQuery;
          (client as unknown as { release: typeof origRelease }).release = origRelease;
          return Reflect.apply(origRelease, client, args);
        };
        return client;
      });
    }) as unknown as typeof pool.connect;

    try {
      await expect(
        service.purchase({
          idempotency_key: idempKey,
          user_id: buyerId,
          slot_id: testSlotId,
          item_id: testItemId,
          recipient_name: 'Nguyen Van T5',
          recipient_phone: '0901234567',
          province: 'HCM',
          district: 'Q1',
          ward: 'BN',
          delivery_address: '123 Le Loi',
        })
      ).rejects.toThrow(/deadlock detected/);

      // Assert 1: Kho Redis được hoàn trả +1 (quay về 5)
      const currentStock = await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`);
      expect(Number(currentStock)).toBe(5);

      // Assert 2: Lease chuyển sang RECLAIMED
      const lease = await redis.get(`flash_sale:lease:${idempKey}`);
      expect(lease).toBe('RECLAIMED');

      // Assert 3: Không có order nào trong DB
      const orderId = await service['repo'].findOrderIdByIdempotencyKey(idempKey);
      expect(orderId).toBeNull();
    } finally {
      pool.connect = originalConnect;
    }
  }, 30_000);

  it('T6. Test Committing Stuck But Committed (Post-Commit Glitch): DB có order, lease kẹt ở COMMITTING:T0 -> Watchdog Healing Path, lease thành COMMITTED, KHÔNG hoàn kho', async () => {
    await service.warmUpSlot(testSlotId);
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-t6-${Date.now()}@test.com`);
    const idempKey = `idemp-t6-${Date.now()}-12345678`;
    const orderId = crypto.randomUUID();

    // 1. Tạo đơn hàng trực tiếp trong DB (giả lập COMMIT đã thành công trên Postgres)
    await pool.query(
      `INSERT INTO orders (order_id, buyer_id, shop_id, recipient_name, recipient_phone, province, district, ward, delivery_address, subtotal, discount_amount, shipping_fee, total_amount, status)
       VALUES ($1, $2, $3, 'Nguyen Van T6', '0901234567', 'HCM', 'Q1', 'BN', '123 Le Loi', 999000, 0, 0, 999000, 'PENDING_CONFIRMATION')`,
      [orderId, buyerId, testShopId]
    );
    await pool.query(
      `INSERT INTO api_idempotency_records (user_id, endpoint, idempotency_key, fingerprint, result, expires_at)
       VALUES ($1, '/api/v1/flash-sales/purchase', $2, '0000000000000000000000000000000000000000000000000000000000000000', $3, now() + interval '1 day')`,
      [buyerId, idempKey, JSON.stringify({ order_id: orderId, total_amount: 999000 })]
    );

    // 2. Cố tình set lease kẹt ở COMMITTING:T0 (hơn 70s trước) và pending_reservations chưa ZREM
    const leaseKey = `flash_sale:lease:${idempKey}`;
    const pastTimestamp = Date.now() - 75_000;
    await redis.set(leaseKey, `COMMITTING:${pastTimestamp}`, 'EX', 86400);

    const payload = JSON.stringify({
      idemp_key: idempKey,
      user_id: buyerId,
      slot_id: testSlotId,
      item_id: testItemId,
      voucher_code: 'NONE',
      created_at: pastTimestamp,
    });
    await redis.zadd('flash_sale:pending_reservations', pastTimestamp, payload);

    // 3. Kích hoạt Watchdog Sweep
    const sweepRes = await service.runWatchdogSweep();

    // 4. Assert 1: Service phát hiện order trong DB -> kích hoạt Healing Path
    expect(sweepRes.selfHealed).toBeGreaterThanOrEqual(1);

    // 5. Assert 2: Kho Redis TUYỆT ĐỐI KHÔNG BỊ CỘNG HOÀN (+0, vẫn giữ nguyên 5)
    const stockAfter = await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`);
    expect(Number(stockAfter)).toBe(5);

    // 6. Assert 3: Lease được chữa lành thành COMMITTED
    const finalLease = await redis.get(leaseKey);
    expect(finalLease).toBe('COMMITTED');

    // 7. Assert 4: ZSet pending_reservations đã được dọn sạch
    const score = await redis.zscore('flash_sale:pending_reservations', payload);
    expect(score).toBeNull();
  }, 30_000);

  it('T7. Test Ambiguous Commit Network Error: COMMIT thành công ở DB nhưng client nhận lỗi ECONNRESET -> Catch block query DB thấy order -> Heal thay vì Compensate', async () => {
    await service.warmUpSlot(testSlotId);
    await redis.set(`flash_sale:stock:${testSlotId}:${testItemId}`, 5);

    const buyerId = crypto.randomUUID();
    await createBuyer(buyerId, `buyer-t7-${Date.now()}@test.com`);
    const idempKey = `idemp-t7-${Date.now()}-12345678`;

    // Hook pool.connect cho purchase(): COMMIT thật thành công, sau đó ném ECONNRESET
    const originalConnect = pool.connect.bind(pool);
    pool.connect = ((cb?: unknown) => {
      if (typeof cb === 'function') {
        return Reflect.apply(originalConnect, pool, [cb]);
      }
      return originalConnect().then((client) => {
        const origQuery = client.query;
        const origRelease = client.release;
        (client as unknown as { query: (...args: unknown[]) => unknown }).query = (...args: unknown[]) => {
          const query = args[0];
          const sql = typeof query === 'string'
            ? query
            : typeof query === 'object' && query !== null && 'text' in query && typeof query.text === 'string'
              ? query.text
              : '';
          if (sql.trim().toUpperCase() === 'COMMIT') {
            return Reflect.apply(origQuery, client, ['COMMIT']).then(() => {
              throw new Error('read ECONNRESET - connection reset by peer (ambiguous commit)');
            });
          }
          return Reflect.apply(origQuery, client, args);
        };
        (client as unknown as { release: (...args: unknown[]) => unknown }).release = (...args: unknown[]) => {
          (client as unknown as { query: typeof origQuery }).query = origQuery;
          (client as unknown as { release: typeof origRelease }).release = origRelease;
          return Reflect.apply(origRelease, client, args);
        };
        return client;
      });
    }) as unknown as typeof pool.connect;

    try {
      // Gọi purchase: Do có Ambiguous Commit verification trong catch, nó phát hiện order trong DB và HEAL thành công
      const result = await service.purchase({
        idempotency_key: idempKey,
        user_id: buyerId,
        slot_id: testSlotId,
        item_id: testItemId,
        recipient_name: 'Nguyen Van T7',
        recipient_phone: '0901234567',
        province: 'HCM',
        district: 'Q1',
        ward: 'BN',
        delivery_address: '123 Le Loi',
      });

      expect(result.success).toBe(true);
      expect(result.order_id).toBeDefined();

      // Assert 1: Kho Redis trừ đúng 1 và KHÔNG BỊ HOÀN TRẢ (5 - 1 = 4)
      const stockAfter = await redis.get(`flash_sale:stock:${testSlotId}:${testItemId}`);
      expect(Number(stockAfter)).toBe(4);

      // Assert 2: Lease là COMMITTED (không bị RECLAIMED)
      const lease = await redis.get(`flash_sale:lease:${idempKey}`);
      expect(lease).toBe('COMMITTED');

      // Assert 3: Order tồn tại hợp lệ trong DB
      const dbOrder = await service['repo'].findOrderIdByIdempotencyKey(idempKey);
      expect(dbOrder).toBe(result.order_id);
    } finally {
      pool.connect = originalConnect;
    }
  }, 30_000);
});


