import '../../src/platform/config/load-root-env.ts';
import { createDatabasePool } from '../../db/client.ts';
import { loadDatabaseConfig } from '../../db/config.ts';
import { getRedisClient, closeRedisClient } from '../../src/modules/flash-sale/infrastructure/redis.client.ts';
import { FlashSaleService } from '../../src/modules/flash-sale/services/flash-sale.service.ts';
import { FlashSaleLuaCode } from '../../src/modules/flash-sale/domain/flash-sale.types.ts';
import { ensureAuthUser, createFixtureUser } from '../db/fixtures/database-fixtures.ts';

async function runBenchmark() {
  console.log('================================================================================');
  console.log('⚡ STARTING FLASH SALE 1,000 CONCURRENT REQUESTS BENCHMARK');
  console.log('================================================================================');

  const dbConfig = loadDatabaseConfig(process.env);
  const pool = createDatabasePool({
    ...dbConfig,
    pool: {
      ...dbConfig.pool,
      max: 5,
    },
  });
  const redis = getRedisClient();
  const service = new FlashSaleService(pool, redis);

  try {
    // 1. Setup Seller & Shop & Category & Product
    console.log('[Setup] Bootstrapping catalog fixtures...');
    const sellerUserId = crypto.randomUUID();
    const sellerEmail = `seller-bench-${Date.now()}@flashsale.test`;
    await ensureAuthUser(pool, sellerUserId, sellerEmail);
    await createFixtureUser(pool, { userId: sellerUserId, email: sellerEmail, role: 'SELLER', status: 'ACTIVE' });

    const shopRes = await pool.query(
      `INSERT INTO shops (shop_id, owner_id, shop_name, status)
       VALUES (gen_random_uuid(), $1, 'Flash Sale Official Shop', 'ACTIVE')
       ON CONFLICT (owner_id) DO UPDATE SET status = 'ACTIVE'
       RETURNING shop_id`,
      [sellerUserId]
    );
    const shopId = shopRes.rows[0].shop_id;

    const catRes = await pool.query(
      `INSERT INTO categories (category_id, category_name, status)
       VALUES (gen_random_uuid(), $1, 'ACTIVE')
       RETURNING category_id`,
      [`Flash Category ${Date.now()}`]
    );
    const catId = catRes.rows[0].category_id;

    const prodRes = await pool.query(
      `INSERT INTO products (product_id, shop_id, category_id, product_name, status)
       VALUES (gen_random_uuid(), $1, $2, 'iPhone 16 Pro Max Ultra', 'ACTIVE')
       RETURNING product_id`,
      [shopId, catId]
    );
    const prodId = prodRes.rows[0].product_id;

    const varRes = await pool.query(
      `INSERT INTO product_variants (variant_id, product_id, variant_name, sku, price, stock_quantity, status)
       VALUES (gen_random_uuid(), $1, 'Titanium Black 256GB', $2, 34000000, 1000, 'ACTIVE')
       RETURNING variant_id`,
      [prodId, `SKU-BENCH-${Date.now()}`]
    );
    const variantId = varRes.rows[0].variant_id;

    // 2. Setup Flash Sale Session & Item with allocated_stock = 10
    const slotId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO flash_sale_sessions (slot_id, slot_name, start_time, end_time, status)
       VALUES ($1, 'Golden Hour 1000-Burst', now() - interval '30 minutes', now() + interval '2 hours', 'ACTIVE')`,
      [slotId]
    );

    const itemId = crypto.randomUUID();
    const allocatedStock = 10;
    await pool.query(
      `INSERT INTO flash_sale_items (item_id, slot_id, product_id, variant_id, original_price, flash_sale_price, allocated_stock)
       VALUES ($1, $2, $3, $4, 34000000, 1990000, $5)`,
      [itemId, slotId, prodId, variantId, allocatedStock]
    );

    // Warm-up tồn kho lên Redis
    await service.warmUpSlot(slotId);
    console.log(`[Setup] Slot ${slotId} warmed up with 10 units.`);

    // 3. Batch tạo 1,000 Virtual Users
    console.log('[Setup] Batch creating 1,000 buyer accounts in Supabase...');
    const userIds: string[] = [];
    const emails: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const uid = crypto.randomUUID();
      userIds.push(uid);
      emails.push(`bench-buyer-${i}-${Date.now()}@bench.test`);
    }

    // Insert theo chunks 200 users để tránh vượt param limit
    const chunkSize = 200;
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunkIds = userIds.slice(i, i + chunkSize);
      const chunkEmails = emails.slice(i, i + chunkSize);

      await pool.query(
        `INSERT INTO auth.users (id, email)
         SELECT unnest($1::uuid[]), unnest($2::text[])
         ON CONFLICT (id) DO NOTHING`,
        [chunkIds, chunkEmails]
      );

      await pool.query(
        `INSERT INTO app_users (user_id, email, role, status)
         SELECT unnest($1::uuid[]), unnest($2::text[]), 'BUYER', 'ACTIVE'
         ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE'`,
        [chunkIds, chunkEmails]
      );
    }
    console.log('[Setup] 1,000 buyers initialized.');

    // 4. Kích hoạt Burst: 1,000 Requests đồng thời qua Promise.all
    console.log('[Benchmark] Firing 1,000 concurrent purchase requests...');
    const latencies: number[] = [];
    const globalStart = performance.now();

    const tasks = userIds.map(async (uid, idx) => {
      const reqStart = performance.now();
      const res = await service.purchase({
        idempotency_key: `idemp-bench-${idx}-${Date.now()}`,
        user_id: uid,
        slot_id: slotId,
        item_id: itemId,
        recipient_name: `Bench Buyer ${idx}`,
        recipient_phone: '0901234567',
        province: 'TP.HCM',
        district: 'Quận 1',
        ward: 'Bến Nghé',
        delivery_address: `123 Đường Số ${idx}`,
      });
      const reqDuration = performance.now() - reqStart;
      latencies.push(reqDuration);
      return res;
    });

    const results = await Promise.all(tasks);
    const totalWallClockMs = performance.now() - globalStart;

    // 5. Tính toán số liệu thống kê
    const successCount = results.filter((r) => r.success).length;
    const soldOutCount = results.filter((r) => !r.success && r.code === FlashSaleLuaCode.PRODUCT_OUT_OF_STOCK).length;
    const otherFailsCount = results.filter((r) => !r.success && r.code !== FlashSaleLuaCode.PRODUCT_OUT_OF_STOCK).length;
    const oversold = Math.max(0, successCount - allocatedStock);

    latencies.sort((a, b) => a - b);
    const minLatency = latencies[0];
    const maxLatency = latencies[latencies.length - 1];
    const avgLatency = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
    const p50 = latencies[Math.floor(latencies.length * 0.50)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const throughput = (1000 / (totalWallClockMs / 1000));

    // 6. Đối soát trực tiếp Database & Redis
    const dbOrderCountRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM order_items WHERE variant_id = $1`,
      [variantId]
    );
    const dbOrderCount = dbOrderCountRes.rows[0].count;

    const redisFinalStock = Number(await redis.get(`flash_sale:stock:${slotId}:${itemId}`));
    const pendingCount = await redis.zcard('flash_sale:pending_reservations');

    // 7. Xuất Báo Cáo
    console.log('\n================================================================================');
    console.log('⚡ FLASH SALE 1,000 CONCURRENT REQUESTS BENCHMARK REPORT (IN-PROCESS)');
    console.log('================================================================================');
    console.log(`Target Product Stock   : ${allocatedStock} units`);
    console.log(`Total Requests Fired   : 1,000 requests`);
    console.log(`Successful Purchases   : ${successCount} (${((successCount / 1000) * 100).toFixed(2)}%)`);
    console.log(`Rejected (Sold Out)    : ${soldOutCount} (${((soldOutCount / 1000) * 100).toFixed(2)}%)`);
    if (otherFailsCount > 0) {
      console.log(`Other Rejections       : ${otherFailsCount}`);
    }
    console.log(`Oversold Items Count   : ${oversold} (0.00%) --> ${oversold === 0 ? '[PASS: ZERO OVERSELLING]' : '[FAIL: OVERSOLD!]'}`);
    console.log('\n--- LATENCY METRICS (Measured via performance.now()) ---');
    console.log(`Min Latency            : ${minLatency.toFixed(2)} ms`);
    console.log(`Average Latency        : ${avgLatency.toFixed(2)} ms`);
    console.log(`Median (P50)           : ${p50.toFixed(2)} ms`);
    console.log(`95th Percentile (P95)  : ${p95.toFixed(2)} ms`);
    console.log(`99th Percentile (P99)  : ${p99.toFixed(2)} ms`);
    console.log(`Max Latency            : ${maxLatency.toFixed(2)} ms`);
    console.log('\n--- THROUGHPUT & DATA INTEGRITY ---');
    console.log(`Total Wall-clock Time  : ${totalWallClockMs.toFixed(2)} ms (${(totalWallClockMs / 1000).toFixed(2)} s)`);
    console.log(`Throughput             : ${throughput.toFixed(2)} req/sec`);
    console.log(`PostgreSQL Orders      : ${dbOrderCount} rows verified (Expected: ${allocatedStock})`);
    console.log(`Redis Stock Key        : ${redisFinalStock} (Expected: 0)`);
    console.log(`Pending Watchdog Leases: ${pendingCount} items`);
    console.log('================================================================================\n');

    if (oversold > 0 || successCount !== 10 || dbOrderCount !== 10 || redisFinalStock !== 0) {
      throw new Error(`Benchmark assertion failed: Concurrency invariant breached!`);
    }
  } finally {
    // Dọn dẹp redis test keys
    const keys = await redis.keys('*flash_sale*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await pool.end();
    closeRedisClient();
  }
}

runBenchmark().catch((err) => {
  console.error('[Benchmark Error]:', err);
  process.exit(1);
});
