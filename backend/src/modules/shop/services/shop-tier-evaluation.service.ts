import type { Pool, PoolClient } from 'pg';

export interface TierEvaluationCriteria {
  readonly minCompletedOrders: number;
  readonly minAverageRating: number;
  readonly minVisibleReviews: number;
}

export const DEFAULT_TIER_CRITERIA: TierEvaluationCriteria = {
  minCompletedOrders: 20,
  minAverageRating: 4.5,
  minVisibleReviews: 5,
};

export type ShopEvaluationStatus =
  | 'SKIPPED_MALL'
  | 'SKIPPED_OVERRIDE'
  | 'PROMOTED'
  | 'DEMOTED'
  | 'UNCHANGED';

export interface ShopEvaluationResult {
  shopId: string;
  shopName: string;
  currentTier: 'STANDARD' | 'PREFERRED' | 'MALL';
  newTier: 'STANDARD' | 'PREFERRED' | 'MALL';
  tierOverride: boolean;
  status: ShopEvaluationStatus;
  stats: {
    completedOrders: number;
    averageRating: number;
    visibleReviewsCount: number;
  };
  reason: string;
}

export interface ShopTierEvaluationSummary {
  totalEvaluated: number;
  promotedCount: number;
  demotedCount: number;
  unchangedCount: number;
  skippedCount: number;
  results: ShopEvaluationResult[];
}

type Queryable = Pool | PoolClient;

export class ShopTierEvaluationService {
  constructor(public readonly pool: Pool) {}

  public async evaluateShopById(
    shopId: string,
    criteria: Partial<TierEvaluationCriteria> = {},
  ): Promise<ShopEvaluationResult | null> {
    return this.evaluateShop(this.pool, shopId, criteria);
  }

  public async evaluateShop(
    clientOrPool: Queryable,
    shopId: string,
    criteria: Partial<TierEvaluationCriteria> = {},
  ): Promise<ShopEvaluationResult | null> {
    const activeCriteria: TierEvaluationCriteria = {
      ...DEFAULT_TIER_CRITERIA,
      ...criteria,
    };

    const shopRes = await clientOrPool.query<{
      shop_id: string;
      shop_name: string;
      tier: 'STANDARD' | 'PREFERRED' | 'MALL';
      tier_override: boolean;
      tier_override_reason: string | null;
      status: string;
    }>(
      `SELECT shop_id, shop_name, COALESCE(tier, 'STANDARD') as tier, COALESCE(tier_override, false) as tier_override, tier_override_reason, status
       FROM shops WHERE shop_id = $1`,
      [shopId],
    );

    const shop = shopRes.rows[0];
    if (!shop) return null;

    // 1. Quy tắc P0-8: Bỏ qua hoàn toàn các shop MALL (chứng nhận thương hiệu thủ công của Admin)
    if (shop.tier === 'MALL') {
      return {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        currentTier: 'MALL',
        newTier: 'MALL',
        tierOverride: shop.tier_override,
        status: 'SKIPPED_MALL',
        stats: { completedOrders: 0, averageRating: 0, visibleReviewsCount: 0 },
        reason: 'Shop MALL is manually certified by Admin and exempt from automated evaluation',
      };
    }

    // 2. Quy tắc P0-8: Bỏ qua hoàn toàn các shop có tier_override = TRUE (do Admin gán thủ công)
    if (shop.tier_override) {
      return {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        currentTier: shop.tier,
        newTier: shop.tier,
        tierOverride: true,
        status: 'SKIPPED_OVERRIDE',
        stats: { completedOrders: 0, averageRating: 0, visibleReviewsCount: 0 },
        reason: `Shop has tier_override enabled: ${shop.tier_override_reason ?? 'Manual Admin override'}`,
      };
    }

    // 3. Tính toán số đơn hoàn tất (COMPLETED)
    const ordersRes = await clientOrPool.query<{ count: string }>(
      "SELECT count(*)::int AS count FROM orders WHERE shop_id = $1 AND status = 'COMPLETED'",
      [shop.shop_id],
    );
    const completedOrders = parseInt(ordersRes.rows[0]?.count ?? '0', 10);

    // 4. Tính toán số review và rating trung bình từ review có status = VISIBLE
    const reviewRes = await clientOrPool.query<{
      visible_count: string;
      avg_rating: string;
    }>(
      `SELECT 
         count(r.review_id)::int AS visible_count,
         COALESCE(AVG(r.rating), 0)::float8 AS avg_rating
       FROM reviews r
       JOIN products p ON r.product_id = p.product_id
       WHERE p.shop_id = $1 AND r.status = 'VISIBLE'`,
      [shop.shop_id],
    );
    const visibleReviewsCount = parseInt(reviewRes.rows[0]?.visible_count ?? '0', 10);
    const averageRating = parseFloat(reviewRes.rows[0]?.avg_rating ?? '0');

    const stats = {
      completedOrders,
      averageRating: Math.round(averageRating * 100) / 100,
      visibleReviewsCount,
    };

    // 5. Đánh giá điều kiện đạt PREFERRED
    const isEligible =
      completedOrders >= activeCriteria.minCompletedOrders &&
      averageRating >= activeCriteria.minAverageRating &&
      visibleReviewsCount >= activeCriteria.minVisibleReviews;

    if (isEligible && shop.tier === 'STANDARD') {
      await clientOrPool.query(
        "UPDATE shops SET tier = 'PREFERRED', updated_at = now() WHERE shop_id = $1 AND tier_override = FALSE",
        [shop.shop_id],
      );
      return {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        currentTier: 'STANDARD',
        newTier: 'PREFERRED',
        tierOverride: false,
        status: 'PROMOTED',
        stats,
        reason: `Eligible for PREFERRED: ${completedOrders} orders >= ${activeCriteria.minCompletedOrders}, rating ${stats.averageRating} >= ${activeCriteria.minAverageRating} (${visibleReviewsCount} reviews)`,
      };
    }

    if (!isEligible && shop.tier === 'PREFERRED') {
      await clientOrPool.query(
        "UPDATE shops SET tier = 'STANDARD', updated_at = now() WHERE shop_id = $1 AND tier_override = FALSE",
        [shop.shop_id],
      );
      return {
        shopId: shop.shop_id,
        shopName: shop.shop_name,
        currentTier: 'PREFERRED',
        newTier: 'STANDARD',
        tierOverride: false,
        status: 'DEMOTED',
        stats,
        reason: `Demoted to STANDARD: failed criteria (orders: ${completedOrders}/${activeCriteria.minCompletedOrders}, rating: ${stats.averageRating}/${activeCriteria.minAverageRating}, reviews: ${visibleReviewsCount}/${activeCriteria.minVisibleReviews})`,
      };
    }

    return {
      shopId: shop.shop_id,
      shopName: shop.shop_name,
      currentTier: shop.tier,
      newTier: shop.tier,
      tierOverride: false,
      status: 'UNCHANGED',
      stats,
      reason: shop.tier === 'PREFERRED'
        ? 'Maintains PREFERRED tier'
        : 'Remains STANDARD tier',
    };
  }

  public async evaluateAllActiveShops(
    criteria: Partial<TierEvaluationCriteria> = {},
  ): Promise<ShopTierEvaluationSummary> {
    const shopsRes = await this.pool.query<{ shop_id: string }>(
      "SELECT shop_id FROM shops WHERE status = 'ACTIVE' ORDER BY created_at ASC",
    );

    const results: ShopEvaluationResult[] = [];
    let promotedCount = 0;
    let demotedCount = 0;
    let unchangedCount = 0;
    let skippedCount = 0;

    for (const row of shopsRes.rows) {
      const res = await this.evaluateShop(this.pool, row.shop_id, criteria);
      if (!res) continue;
      results.push(res);
      if (res.status === 'PROMOTED') promotedCount += 1;
      else if (res.status === 'DEMOTED') demotedCount += 1;
      else if (res.status === 'UNCHANGED') unchangedCount += 1;
      else if (res.status.startsWith('SKIPPED')) skippedCount += 1;
    }

    return {
      totalEvaluated: results.length,
      promotedCount,
      demotedCount,
      unchangedCount,
      skippedCount,
      results,
    };
  }
}
