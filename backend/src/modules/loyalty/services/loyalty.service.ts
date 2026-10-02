import type { Pool, PoolClient } from 'pg';
import {
  type BuyerTier,
  type LoyaltyInfo,
  type PaginatedLoyaltyHistory,
  calculateLoyaltyAccrual,
  formatCents,
  parseCents,
} from '../domain/loyalty.types.ts';
import { NotFoundError } from '../../../platform/errors/app-error.ts';

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
      `INSERT INTO loyalty_point_transactions (transaction_id, user_id, points_delta, reference_order_id, reason)
       VALUES ($1, $2, $3, $4, 'ORDER_COMPLETED')
       ON CONFLICT (reference_order_id) WHERE reason = 'ORDER_COMPLETED'
       DO NOTHING
       RETURNING transaction_id`,
      [transactionId, order.buyer_id, pointsDelta, order.order_id]
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
