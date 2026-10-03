import type { Pool, PoolClient } from 'pg';
import type { Redis } from 'ioredis';
import {
  FlashSaleLuaCode,
  type PurchaseFlashSaleCommand,
  type PurchaseFlashSaleResult,
  type ReconciliationReport,
  type PendingReservationPayload,
} from '../domain/flash-sale.types.ts';
import { PgFlashSaleRepository } from '../repositories/pg-flash-sale.repository.ts';
import { FLASH_SALE_DEDUCT_LUA } from '../infrastructure/lua/flash-sale-deduct.lua.ts';
import { FLASH_SALE_COMPENSATE_LUA } from '../infrastructure/lua/flash-sale-compensate.lua.ts';

export class FlashSaleService {
  private repo: PgFlashSaleRepository;

  constructor(
    private readonly pool: Pool,
    private readonly redis: Redis,
  ) {
    this.repo = new PgFlashSaleRepository(pool);
  }

  /**
   * 1. Warm-up tồn kho và quota voucher lên Redis trước giờ Flash Sale
   */
  async warmUpSlot(slotId: string): Promise<{ success: boolean; message: string }> {
    const lockKey = `flash_sale:warmup_lock:${slotId}`;
    const acquired = await this.redis.set(lockKey, 'locked', 'EX', 60, 'NX');
    if (!acquired) {
      return { success: false, message: 'Slot đang được warm-up bởi instance khác.' };
    }

    try {
      const session = await this.repo.findSessionById(slotId);
      if (!session) {
        return { success: false, message: 'Không tìm thấy khung giờ Flash Sale.' };
      }

      const items = await this.repo.listItemsBySlotId(slotId);
      const slotEndEpoch = new Date(session.end_time).getTime();
      const now = Date.now();
      const ttlSeconds = Math.max(3600, Math.floor((slotEndEpoch - now) / 1000) + 86400);

      // Cập nhật trạng thái Slot vào Redis (chống TOCTOU)
      await this.redis.set(`flash_sale:slot_status:${slotId}`, session.status, 'EX', ttlSeconds);

      // Nạp stock từng sản phẩm
      for (const item of items) {
        const stockKey = `flash_sale:stock:${slotId}:${item.item_id}`;
        await this.redis.set(stockKey, item.allocated_stock, 'EX', ttlSeconds);
      }

      console.log(`[FlashSale] Warmed up slot ${slotId} with ${items.length} items. TTL: ${ttlSeconds}s`);
      return { success: true, message: `Nạp thành công ${items.length} sản phẩm lên Redis.` };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * Cập nhật trạng thái slot trên Redis (ví dụ: chuyển từ UPCOMING sang ACTIVE)
   */
  async setSlotStatus(slotId: string, status: 'UPCOMING' | 'ACTIVE' | 'ENDED'): Promise<void> {
    await this.pool.query('UPDATE flash_sale_sessions SET status = $1, updated_at = now() WHERE slot_id = $2', [status, slotId]);
    await this.redis.set(`flash_sale:slot_status:${slotId}`, status, 'EX', 86400 * 2);
  }

  /**
   * 2. Mua hàng Flash Sale với phòng thủ 3 tầng và chống tranh chấp Voucher
   */
  async purchase(command: PurchaseFlashSaleCommand): Promise<PurchaseFlashSaleResult> {
    const { user_id, idempotency_key, slot_id, item_id, voucher_code } = command;
    const effectiveVoucher = voucher_code && voucher_code.trim() !== '' ? voucher_code.trim() : 'NONE';
    const idempKey = `flash_sale:idemp:${user_id}:${idempotency_key}`;
    const leaseKey = `flash_sale:lease:${idempotency_key}`;

    // ------------------------------------------------------------------------
    // TẦNG 1: REDIS FAST-PATH & IDEMPOTENCY CHECK
    // ------------------------------------------------------------------------
    const acquired = await this.redis.set(idempKey, 'IN_PROGRESS', 'EX', 600, 'NX');
    if (!acquired) {
      const existingVal = await this.redis.get(idempKey);
      if (existingVal && existingVal !== 'IN_PROGRESS') {
        try {
          const parsed = JSON.parse(existingVal);
          return {
            success: true,
            order_id: parsed.order_id,
            code: FlashSaleLuaCode.SUCCESS,
            message: 'Đơn hàng đã được đặt thành công (Idempotent Replay)',
            is_replay: true,
          };
        } catch {
          // ignore parsing error
        }
      }
      return {
        success: false,
        code: FlashSaleLuaCode.SUCCESS,
        message: 'Yêu cầu đang được xử lý, vui lòng không bấm liên tục.',
      };
    }

    const payloadObj: PendingReservationPayload = {
      idemp_key: idempotency_key,
      user_id,
      slot_id,
      item_id,
      voucher_code: effectiveVoucher,
      created_at: Date.now(),
    };
    const payloadStr = JSON.stringify(payloadObj);

    // Chạy Lua Script trừ tồn kho và voucher quota nguyên tử
    const deductKeys = [
      `flash_sale:stock:${slot_id}:${item_id}`,
      `flash_sale:buyers:${slot_id}:${item_id}`,
      `voucher:quota:${slot_id}:${effectiveVoucher}`,
      `voucher:used_users:${slot_id}:${effectiveVoucher}`,
      `flash_sale:slot_status:${slot_id}`,
      'flash_sale:pending_reservations',
      leaseKey,
    ];

    const deductResult = Number(
      await this.redis.eval(
        FLASH_SALE_DEDUCT_LUA,
        deductKeys.length,
        ...deductKeys,
        user_id,
        effectiveVoucher,
        Date.now().toString(),
        payloadStr
      )
    );

    if (deductResult !== 1) {
      await this.redis.del(idempKey);
      const code = deductResult as FlashSaleLuaCode;
      let msg = 'Đặt hàng không thành công.';
      if (code === FlashSaleLuaCode.PRODUCT_OUT_OF_STOCK) msg = 'Sản phẩm Flash Sale đã hết hàng.';
      else if (code === FlashSaleLuaCode.SLOT_NOT_ACTIVE) msg = 'Khung giờ Flash Sale chưa mở hoặc đã kết thúc.';
      else if (code === FlashSaleLuaCode.USER_PURCHASE_LIMIT_EXCEEDED) msg = 'Mỗi khách hàng chỉ được mua 1 sản phẩm Flash Sale trong khung giờ.';
      else if (code === FlashSaleLuaCode.VOUCHER_ALREADY_USED_BY_USER) msg = 'Voucher đã được tài khoản của bạn sử dụng.';
      else if (code === FlashSaleLuaCode.VOUCHER_OUT_OF_STOCK) msg = 'Voucher khuyến mãi đã hết lượt sử dụng.';

      return { success: false, code, message: msg };
    }

    // ------------------------------------------------------------------------
    // TẦNG 2: POSTGRESQL TRANSACTION (SINGLE SOURCE OF TRUTH)
    // ------------------------------------------------------------------------
    const client: PoolClient = await this.pool.connect();
    let orderId = '';

    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout = '10000'");

      // Lấy thông tin Flash Sale Item & Product Variant
      const itemRes = await client.query(
        `SELECT fsi.item_id, fsi.product_id, fsi.flash_sale_price, fsi.variant_id, p.shop_id, p.product_name, pv.variant_name, pv.price as orig_price
         FROM flash_sale_items fsi
         JOIN products p ON fsi.product_id = p.product_id
         JOIN product_variants pv ON fsi.variant_id = pv.variant_id
         WHERE fsi.item_id = $1`,
        [item_id]
      );

      if (itemRes.rows.length === 0) {
        throw new Error('FLASH_SALE_ITEM_NOT_FOUND_IN_DB');
      }

      const itemData = itemRes.rows[0];
      const unitPrice = Number(itemData.flash_sale_price);
      let discountAmount = 0;

      // Xử lý Voucher trong Postgres nếu có
      if (effectiveVoucher !== 'NONE') {
        const vRes = await client.query(
          `UPDATE vouchers
           SET quantity = quantity - 1, updated_at = now()
           WHERE code = $1 AND status = 'ACTIVE' AND quantity > 0
           RETURNING voucher_id, discount_type, discount_value, max_discount, min_order_value`,
          [effectiveVoucher]
        );

        if (vRes.rows.length > 0) {
          const vData = vRes.rows[0];
          if (vData.discount_type === 'PERCENT') {
            discountAmount = (unitPrice * Number(vData.discount_value)) / 100;
            if (vData.max_discount) {
              discountAmount = Math.min(discountAmount, Number(vData.max_discount));
            }
          } else {
            discountAmount = Math.min(unitPrice, Number(vData.discount_value));
          }
        }
      }

      orderId = crypto.randomUUID();
      const shippingFee = 0;
      const subtotal = unitPrice;
      const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount);

      // Tạo Order
      await client.query(
        `INSERT INTO orders (
          order_id, buyer_id, shop_id, recipient_name, recipient_phone,
          province, district, ward, delivery_address,
          subtotal, discount_amount, shipping_fee, total_amount, status, cancel_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING_CONFIRMATION', $14)`,
        [
          orderId,
          user_id,
          itemData.shop_id,
          command.recipient_name,
          command.recipient_phone,
          command.province,
          command.district,
          command.ward,
          command.delivery_address,
          subtotal,
          discountAmount,
          shippingFee,
          totalAmount,
          idempotency_key, // Lưu idempotency_key vào cancel_reason / note để đối soát
        ]
      );

      // Tạo OrderItem
      await client.query(
        `INSERT INTO order_items (
          order_item_id, order_id, product_id, variant_id,
          product_name_snapshot, variant_snapshot, unit_price, quantity, line_total
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $7)`,
        [
          crypto.randomUUID(),
          orderId,
          itemData.product_id,
          itemData.variant_id,
          itemData.product_name,
          itemData.variant_name,
          unitPrice,
        ]
      );

      // Ghi nhận Idempotency Record vào Postgres
      const fingerprint = '0'.repeat(64);
      await client.query(
        `INSERT INTO api_idempotency_records (user_id, endpoint, idempotency_key, fingerprint, result, expires_at)
         VALUES ($1, '/api/v1/flash-sales/purchase', $2, $3, $4, now() + interval '1 day')
         ON CONFLICT (user_id, endpoint, idempotency_key) DO NOTHING`,
        [user_id, idempotency_key, fingerprint, JSON.stringify({ order_id: orderId, total_amount: totalAmount })]
      );

      // COMMIT TRANSACTION TRƯỚC (ĐIỂM CHỐT SỰ THẬT DUY NHẤT)
      await client.query('COMMIT');
    } catch (err: unknown) {
      await client.query('ROLLBACK');

      // TẦNG 3 (ERROR): FAST ROLLBACK & LOG COMPENSATION
      const compId = crypto.randomUUID();
      await this.repo.insertCompensationLog({
        compensation_id: compId,
        slot_id,
        item_id,
        user_id,
        reason: `DB_TRANSACTION_FAILED: ${err instanceof Error ? err.message : String(err)}`,
        status: 'PENDING',
      });

      const compKeys = [
        `flash_sale:stock:${slot_id}:${item_id}`,
        `flash_sale:buyers:${slot_id}:${item_id}`,
        `voucher:quota:${slot_id}:${effectiveVoucher}`,
        `voucher:used_users:${slot_id}:${effectiveVoucher}`,
        'flash_sale:pending_reservations',
        leaseKey,
      ];

      const compRes = await this.redis.eval(
        FLASH_SALE_COMPENSATE_LUA,
        compKeys.length,
        ...compKeys,
        user_id,
        effectiveVoucher,
        payloadStr
      );

      if (compRes === 1) {
        await this.repo.updateCompensationLogStatus(compId, 'APPLIED');
      }

      await this.redis.del(idempKey);
      throw err;
    } finally {
      client.release();
    }

    // ------------------------------------------------------------------------
    // TẦNG 3: CLEANUP AN TOÀN TUYỆT ĐỐI (ĐÚNG THỨ TỰ SPEC V8)
    // ------------------------------------------------------------------------
    // 1. Ghi Idempotency Replay Cache
    const resultObj = {
      success: true,
      order_id: orderId,
      code: FlashSaleLuaCode.SUCCESS,
      message: 'Đặt hàng Flash Sale thành công!',
    };
    await this.redis.set(idempKey, JSON.stringify(resultObj), 'EX', 600);

    // 2. Chuyển Lease sang COMMITTED
    await this.redis.set(leaseKey, 'COMMITTED', 'EX', 86400);

    // 3. Tháo phao an toàn khỏi ZSet (LÀM BƯỚC CUỐI CÙNG!)
    await this.redis.zrem('flash_sale:pending_reservations', payloadStr);

    return resultObj;
  }

  /**
   * 3. Watchdog tự chữa lành (Self-healing Orphaned Reservations)
   */
  async runWatchdogSweep(): Promise<{ swept: number; selfHealed: number; compensated: number }> {
    const lockKey = 'flash_sale:watchdog_lock';
    const acquired = await this.redis.set(lockKey, 'locked', 'EX', 25, 'NX');
    if (!acquired) {
      return { swept: 0, selfHealed: 0, compensated: 0 };
    }

    let selfHealed = 0;
    let compensated = 0;

    try {
      const cutoff = Date.now() - 30_000; // Quá hạn 30s
      const overdue = await this.redis.zrangebyscore('flash_sale:pending_reservations', 0, cutoff);

      for (const memberStr of overdue) {
        let payload: PendingReservationPayload;
        try {
          payload = JSON.parse(memberStr);
        } catch {
          await this.redis.zrem('flash_sale:pending_reservations', memberStr);
          continue;
        }

        const { idemp_key, user_id, slot_id, item_id, voucher_code } = payload;
        const leaseKey = `flash_sale:lease:${idemp_key}`;
        const idempKey = `flash_sale:idemp:${user_id}:${idemp_key}`;

        // 1. Cross-check với Nguồn Sự Thật Duy Nhất (PostgreSQL)
        const orderId = await this.repo.findOrderIdByIdempotencyKey(idemp_key);

        if (orderId) {
          // CASE A: Server cũ đã commit thành công nhưng crash trước khi ZREM
          // Khôi phục Replay Cache và dọn dẹp (KHÔNG HOÀN KHO!)
          await this.redis.set(idempKey, JSON.stringify({ success: true, order_id: orderId }), 'EX', 600);
          await this.redis.set(leaseKey, 'COMMITTED', 'EX', 86400);
          await this.redis.zrem('flash_sale:pending_reservations', memberStr);
          selfHealed++;
        } else {
          // CASE B: Server crash trước khi commit Order -> Hoàn kho an toàn
          const compId = crypto.randomUUID();
          await this.repo.insertCompensationLog({
            compensation_id: compId,
            slot_id,
            item_id,
            user_id,
            reason: 'CRASH_CONFIRMED_BEFORE_COMMIT',
            status: 'PENDING',
          });

          const compKeys = [
            `flash_sale:stock:${slot_id}:${item_id}`,
            `flash_sale:buyers:${slot_id}:${item_id}`,
            `voucher:quota:${slot_id}:${voucher_code}`,
            `voucher:used_users:${slot_id}:${voucher_code}`,
            'flash_sale:pending_reservations',
            leaseKey,
          ];

          const compRes = await this.redis.eval(
            FLASH_SALE_COMPENSATE_LUA,
            compKeys.length,
            ...compKeys,
            user_id,
            voucher_code,
            memberStr
          );

          if (compRes === 1) {
            await this.repo.updateCompensationLogStatus(compId, 'APPLIED');
          }

          await this.redis.del(idempKey);
          compensated++;
        }
      }

      return { swept: overdue.length, selfHealed, compensated };
    } finally {
      await this.redis.del(lockKey);
    }
  }

  /**
   * 4. Đối soát số liệu giữa Redis và Database (Reconciliation)
   */
  async reconcileSlot(slotId: string): Promise<ReconciliationReport> {
    const session = await this.repo.findSessionById(slotId);
    if (!session) {
      throw new Error('Khung giờ Flash Sale không tồn tại.');
    }

    const items = await this.repo.listItemsBySlotId(slotId);
    let totalAllocated = 0;
    let totalRedisRemaining = 0;

    for (const item of items) {
      totalAllocated += item.allocated_stock;
      const stockVal = await this.redis.get(`flash_sale:stock:${slotId}:${item.item_id}`);
      totalRedisRemaining += stockVal !== null ? Number(stockVal) : item.allocated_stock;
    }

    const soldViaRedis = totalAllocated - totalRedisRemaining;
    const { validOrders, appliedCompensations } = await this.repo.getReconciliationCounts(slotId);

    // Công thức: Discrepancy = SoldViaRedis - ValidOrders
    const discrepancy = soldViaRedis - validOrders;

    return {
      slot_id: session.slot_id,
      slot_name: session.slot_name,
      allocated_stock: totalAllocated,
      remaining_redis_stock: totalRedisRemaining,
      sold_via_redis: soldViaRedis,
      valid_orders_in_db: validOrders,
      compensation_applied_count: appliedCompensations,
      discrepancy,
      is_balanced: discrepancy === 0,
      timestamp: new Date().toISOString(),
    };
  }
}
