import type { Pool, PoolClient } from 'pg';
import {
  type BuyerTier,
  type LoyaltyInfo,
  type PaginatedLoyaltyHistory,
  calculateLoyaltyAccrual,
  formatCents,
  parseCents,
} from '../domain/loyalty.types.ts';
import { ConflictError, NotFoundError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import { withTransaction } from '../../../../db/transaction.ts';

export interface CompletedOrderInput {
  readonly order_id: string;
  readonly buyer_id: string;
  readonly subtotal: string;
  readonly discount_amount: string;
}

export interface RecordAccrualResult {
  readonly pointsDelta: number;
  readonly newTotalSpent: string;
  readonly newTier: BuyerTier;
  readonly inserted: boolean;
}

export class LoyaltyService {
  constructor(private readonly pool: Pool) {}

  /**
   * Records loyalty points and total spent when an order transitions to COMPLETED.
   * MUST be called within the caller's database transaction.
   * Acquires row-level lock on app_users FOR UPDATE to prevent race conditions.
   * Uses ON CONFLICT DO NOTHING to prevent duplicate awards.
   */
  async recordOrderCompleted(client: PoolClient, order: CompletedOrderInput): Promise<RecordAccrualResult> {
    // 1. Lock the buyer record FOR UPDATE
    const buyerRes = await client.query<{
      user_id: string;
      buyer_tier: string;
      total_spent: string;
      loyalty_points: number;
    }>(
      'SELECT user_id, buyer_tier, total_spent, loyalty_points FROM app_users WHERE user_id = $1 FOR UPDATE',
      [order.buyer_id]
    );

    const buyer = buyerRes.rows[0];
    if (!buyer) {
      throw new NotFoundError('Buyer account not found for loyalty accrual.');
    }

    const oldTier = (buyer.buyer_tier === 'VIP' ? 'VIP' : 'STANDARD') as BuyerTier;
    const oldTotalSpentCents = parseCents(buyer.total_spent, 'total_spent');
    const subtotalCents = parseCents(order.subtotal, 'subtotal');
    const discountCents = parseCents(order.discount_amount, 'discount_amount');

    // 2. Compute exact domain logic without floating points
    const { pointsDelta, newTotalSpentCents, newTier } = calculateLoyaltyAccrual({
      oldTotalSpentCents,
      oldTier,
      subtotalCents,
      discountCents,
    });

    // 3. Insert transaction into ledger with ON CONFLICT DO NOTHING
    const transactionId = crypto.randomUUID();
    const insertRes = await client.query(
      `INSERT INTO loyalty_point_transactions (transaction_id, user_id, points_delta, reference_order_id, reason, eligible_spent_amount)
       VALUES ($1, $2, $3, $4, 'ORDER_COMPLETED', $5)
       ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED'
       DO NOTHING
       RETURNING transaction_id`,
      [transactionId, order.buyer_id, pointsDelta, order.order_id, formatCents(subtotalCents > discountCents ? subtotalCents - discountCents : 0n)]
    );

    // 4. ONLY update app_users if the ledger row was newly inserted
    if (insertRes.rowCount === 1) {
      const newTotalSpentStr = formatCents(newTotalSpentCents);
      await client.query(
        `UPDATE app_users
         SET buyer_tier = $1,
             total_spent = $2,
             loyalty_points = loyalty_points + $3,
             updated_at = now()
         WHERE user_id = $4`,
        [newTier, newTotalSpentStr, pointsDelta, order.buyer_id]
      );

      return {
        pointsDelta,
        newTotalSpent: newTotalSpentStr,
        newTier,
        inserted: true,
      };
    }

    // Duplicate completion: do not double-increment
    return {
      pointsDelta: 0,
      newTotalSpent: buyer.total_spent,
      newTier: oldTier,
      inserted: false,
    };
  }

  async listRewards(userId: string) {
    const result = await this.pool.query<{ voucher_id: string; code: string; end_at: Date; quantity: number; expired: boolean }>(
      `SELECT voucher_id, code, end_at, quantity, end_at <= now() AS expired FROM vouchers
       WHERE loyalty_owner_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId],
    );
    return result.rows.map(row => ({ ...row, end_at: row.end_at.toISOString() }));
  }

  async redeem(userId: string, key: unknown) {
    if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
      throw new ValidationFailedError('idempotency_key must be a UUID.');
    }
    return withTransaction(this.pool, async client => {
      const buyer = await client.query<{ loyalty_points: number }>("SELECT loyalty_points FROM app_users WHERE user_id=$1 AND role='BUYER' AND status='ACTIVE' FOR UPDATE", [userId]);
      if (!buyer.rows[0]) throw new NotFoundError('Buyer not found.');
      const operationKey = `redeem:${userId}:${key.toLowerCase()}`;
      const existing = await client.query<{ voucher_id: string; code: string; end_at: Date }>(
        `SELECT v.voucher_id,v.code,v.end_at FROM loyalty_point_transactions l JOIN vouchers v ON v.voucher_id=l.voucher_id WHERE l.operation_key=$1`, [operationKey],
      );
      if (existing.rows[0]) return { ...existing.rows[0], end_at: existing.rows[0].end_at.toISOString() };
      if (buyer.rows[0].loyalty_points < 100) throw new ConflictError('INSUFFICIENT_POINTS', 'Cần ít nhất 100 DinoPoint để đổi voucher.');
      const voucherId = crypto.randomUUID();
      const code = `DINO${voucherId.replaceAll('-', '').toUpperCase()}`;
      const voucher = await client.query<{ end_at: Date }>(
        `INSERT INTO vouchers (voucher_id,code,voucher_name,scope,shop_id,discount_type,discount_value,min_order_value,quantity,start_at,end_at,status,loyalty_owner_id)
         VALUES ($1,$2,'DinoPoint giảm 10.000đ','PLATFORM',NULL,'FIXED',10000,100000,1,now(),now()+interval '30 days','ACTIVE',$3) RETURNING end_at`, [voucherId, code, userId],
      );
      await client.query(`INSERT INTO loyalty_point_transactions (transaction_id,user_id,points_delta,reason,operation_key,voucher_id)
        VALUES ($1,$2,-100,'POINTS_REDEEMED',$3,$4)`, [crypto.randomUUID(), userId, operationKey, voucherId]);
      await client.query('UPDATE app_users SET loyalty_points=loyalty_points-100,updated_at=now() WHERE user_id=$1', [userId]);
      return { voucher_id: voucherId, code, end_at: voucher.rows[0].end_at.toISOString() };
    });
  }

  /** Admin records an already successful refund; this does not move money. */
  async recordConfirmedRefund(adminId: string, orderId: string, input: Record<string, unknown>) {
    if (typeof input.reference !== 'string' || !/^[A-Za-z0-9:_-]{5,160}$/.test(input.reference)
      || typeof input.reason !== 'string' || input.reason.trim().length < 5 || input.reason.length > 1000
      || typeof input.eligible_amount !== 'string') {
      throw new ValidationFailedError('Provide a refund reference, reason and decimal eligible_amount.');
    }
    let amount: bigint;
    try { amount = parseCents(input.eligible_amount); } catch { throw new ValidationFailedError('Invalid eligible_amount.'); }
    if (amount <= 0n) throw new ValidationFailedError('eligible_amount must be positive.');
    const reference = input.reference;
    const reason = input.reason.trim();
    return withTransaction(this.pool, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`refund:${reference}`]);
      const order = await client.query<{ buyer_id: string; status: string; subtotal: string; discount_amount: string }>(
        'SELECT buyer_id,status,subtotal,discount_amount FROM orders WHERE order_id=$1 FOR UPDATE', [orderId],
      );
      const row = order.rows[0];
      if (!row) throw new NotFoundError('Order not found.');
      if (row.status !== 'COMPLETED') throw new ConflictError('ORDER_NOT_COMPLETED', 'Only completed orders have loyalty to reverse.');
      const buyer = await client.query<{ total_spent: string }>('SELECT total_spent FROM app_users WHERE user_id=$1 FOR UPDATE', [row.buyer_id]);
      const operationKey = `refund:${reference}`;
      const existing = await client.query<{ reference_order_id: string; refunded_eligible_amount: string; points_delta: number }>(
        'SELECT reference_order_id,refunded_eligible_amount,points_delta FROM loyalty_point_transactions WHERE operation_key=$1', [operationKey],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].reference_order_id !== orderId || parseCents(existing.rows[0].refunded_eligible_amount) !== amount) {
          throw new ConflictError('REFUND_REFERENCE_REUSED', 'Refund reference was already used with different data.');
        }
        return { points_delta: existing.rows[0].points_delta, inserted: false };
      }
      const accrual = await client.query<{ points_delta: number; eligible_spent_amount: string | null }>(
        "SELECT points_delta,eligible_spent_amount FROM loyalty_point_transactions WHERE reference_order_id=$1 AND reason='ORDER_COMPLETED'", [orderId],
      );
      if (!accrual.rows[0]) throw new ConflictError('NO_LOYALTY_ACCRUAL', 'Order has no recorded loyalty award.');
      const eligible = parseCents(accrual.rows[0].eligible_spent_amount ?? formatCents(parseCents(row.subtotal) - parseCents(row.discount_amount)));
      const prior = await client.query<{ amount: string; points: string }>(
        "SELECT COALESCE(SUM(refunded_eligible_amount),0)::text AS amount, COALESCE(-SUM(points_delta),0)::text AS points FROM loyalty_point_transactions WHERE reference_order_id=$1 AND reason='ORDER_REFUND'", [orderId],
      );
      const cumulative = parseCents(prior.rows[0].amount) + amount;
      if (eligible === 0n || cumulative > eligible) throw new ConflictError('REFUND_EXCEEDS_ELIGIBLE_AMOUNT', 'Refund exceeds the remaining eligible spending.');
      const pointsDelta = Number(-((BigInt(accrual.rows[0].points_delta) * cumulative / eligible) - BigInt(prior.rows[0].points)));
      const totalSpent = parseCents(buyer.rows[0].total_spent);
      if (amount > totalSpent) throw new ConflictError('LOYALTY_BALANCE_INCONSISTENT', 'Refund exceeds recorded spending.');
      await client.query(`INSERT INTO loyalty_point_transactions (transaction_id,user_id,points_delta,reference_order_id,reason,operation_key,refunded_eligible_amount)
        VALUES ($1,$2,$3,$4,'ORDER_REFUND',$5,$6)`, [crypto.randomUUID(), row.buyer_id, pointsDelta, orderId, operationKey, formatCents(amount)]);
      await client.query('UPDATE app_users SET total_spent=$2,loyalty_points=loyalty_points+$3,updated_at=now() WHERE user_id=$1', [row.buyer_id, formatCents(totalSpent-amount), pointsDelta]);
      await client.query(`INSERT INTO admin_logs (log_id,admin_id,action,target_type,target_id,reason)
        VALUES ($1,$2,'LOYALTY_REFUND_CONFIRMED','ORDER',$3,$4)`, [crypto.randomUUID(), adminId, orderId, `${reference}; ${formatCents(amount)}; ${reason}`]);
      return { points_delta: pointsDelta, inserted: true };
    });
  }

  /**
   * Retrieves loyalty summary for the given buyer.
   */
  async getLoyaltyInfo(userId: string): Promise<LoyaltyInfo> {
    const res = await this.pool.query<{
      buyer_tier: string;
      total_spent: string;
      loyalty_points: number;
    }>(
      'SELECT buyer_tier, total_spent, loyalty_points FROM app_users WHERE user_id = $1',
      [userId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new NotFoundError('User not found.');
    }

    const tier = (row.buyer_tier === 'VIP' ? 'VIP' : 'STANDARD') as BuyerTier;
    return {
      tier,
      total_spent: row.total_spent ?? '0.00',
      loyalty_points: row.loyalty_points ?? 0,
      vip_threshold: '5000000.00',
      points_multiplier: tier === 'VIP' ? 2 : 1,
      next_tier: tier === 'VIP' ? null : 'VIP',
    };
  }

  /**
   * Retrieves paginated point history for the buyer.
   */
  async getLoyaltyHistory(userId: string, page = 1, limit = 10): Promise<PaginatedLoyaltyHistory> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countRes = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM loyalty_point_transactions WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countRes.rows[0]?.count ?? '0', 10);

    const rowsRes = await this.pool.query<{
      transaction_id: string;
      user_id: string;
      points_delta: number;
      reference_order_id: string | null;
      reason: string;
      created_at: Date;
    }>(
      `SELECT transaction_id, user_id, points_delta, reference_order_id, reason, created_at
       FROM loyalty_point_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset]
    );

    return {
      items: rowsRes.rows.map(row => ({
        transaction_id: row.transaction_id,
        user_id: row.user_id,
        points_delta: row.points_delta,
        reference_order_id: row.reference_order_id,
        reason: row.reason,
        created_at: row.created_at.toISOString(),
      })),
      page: safePage,
      limit: safeLimit,
      total,
    };
  }
}
