import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import {
  ShopTierEvaluationService,
  type TierEvaluationCriteria,
} from '../../src/modules/shop/services/shop-tier-evaluation.service.ts';
import { PgProductRepository } from '../../src/modules/catalog/repositories/pg-catalog.repository.ts';

interface MockShopRow {
  shop_id: string;
  shop_name: string;
  tier: 'STANDARD' | 'PREFERRED' | 'MALL';
  tier_override: boolean;
  tier_override_reason: string | null;
  status: string;
}

interface MockOrderRow {
  order_id: string;
  shop_id: string;
  status: string;
}

interface MockReviewRow {
  review_id: string;
  product_id: string;
  rating: number;
  status: 'VISIBLE' | 'HIDDEN';
}

interface MockProductRow {
  product_id: string;
  shop_id: string;
}

function createMockDb(
  initialShops: MockShopRow[],
  orders: MockOrderRow[],
  reviews: MockReviewRow[],
  products: MockProductRow[] = [],
) {
  const shops = [...initialShops];

  const pool = {
    async query(sql: string, params?: unknown[]) {
      const normalizedSql = sql.replaceAll('\n', ' ').trim();

      // Query single shop
      if (normalizedSql.includes('SELECT shop_id, shop_name') && normalizedSql.includes('FROM shops WHERE shop_id = $1')) {
        const shopId = params?.[0];
        const match = shops.find((s) => s.shop_id === shopId);
        return { rows: match ? [match] : [] };
      }

      // Query active shops
      if (normalizedSql.includes("SELECT shop_id FROM shops WHERE status = 'ACTIVE'")) {
        const activeShops = shops.filter((s) => s.status === 'ACTIVE');
        return { rows: activeShops.map((s) => ({ shop_id: s.shop_id })) };
      }

      // Query completed orders count
      if (normalizedSql.includes('SELECT count(*)::int AS count FROM orders WHERE shop_id = $1')) {
        const shopId = params?.[0];
        const count = orders.filter((o) => o.shop_id === shopId && o.status === 'COMPLETED').length;
        return { rows: [{ count: String(count) }] };
      }

      // Query visible reviews count and avg rating
      if (normalizedSql.includes('FROM reviews r') && normalizedSql.includes("r.status = 'VISIBLE'")) {
        const targetShopId = params?.[0];
        const visibleReviews = reviews.filter((r) => {
          if (r.status !== 'VISIBLE') return false;
          if (products.length > 0) {
            const prod = products.find((p) => p.product_id === r.product_id);
            return prod ? prod.shop_id === targetShopId : false;
          }
          return true;
        });
        const count = visibleReviews.length;
        const avg = count > 0 ? visibleReviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;
        return { rows: [{ visible_count: String(count), avg_rating: String(avg) }] };
      }

      // Update shop tier
      if (normalizedSql.includes('UPDATE shops SET tier =')) {
        const targetTier = normalizedSql.includes("'PREFERRED'") ? 'PREFERRED' : 'STANDARD';
        const shopId = params?.[0];
        const target = shops.find((s) => s.shop_id === shopId);
        if (target && !target.tier_override) {
          target.tier = targetTier;
        }
        return { rowCount: 1 };
      }

      return { rows: [] };
    },
  } as unknown as Pool;

  return { pool, shops };
}

describe('Đợt C: ShopTierEvaluationService & Automated PREFERRED Evaluation', () => {
  const criteria: TierEvaluationCriteria = {
    minCompletedOrders: 20,
    minAverageRating: 4.5,
    minVisibleReviews: 5,
  };

  it('TEST-C1: Skips shop with tier = MALL (P0-8: Admin certified MALL is exempt from auto downgrade/upgrade)', async () => {
    const { pool, shops } = createMockDb(
      [
        {
          shop_id: 'shop-mall-1',
          shop_name: 'Dino Official Flagship',
          tier: 'MALL',
          tier_override: false,
          tier_override_reason: null,
          status: 'ACTIVE',
        },
      ],
      [],
      [],
    );

    const service = new ShopTierEvaluationService(pool);
    const result = await service.evaluateShop(pool, 'shop-mall-1', criteria);

    assert.ok(result);
    assert.equal(result.status, 'SKIPPED_MALL');
    assert.equal(result.newTier, 'MALL');
    assert.equal(shops[0].tier, 'MALL');
    assert.match(result.reason, /certified by Admin/i);
  });

  it('TEST-C2: Skips shop with tier_override = TRUE (P0-8: Admin manual override is preserved)', async () => {
    const { pool, shops } = createMockDb(
      [
        {
          shop_id: 'shop-override-1',
          shop_name: 'Special Partner Shop',
          tier: 'PREFERRED',
          tier_override: true,
          tier_override_reason: 'Admin granted strategic partner exemption',
          status: 'ACTIVE',
        },
      ],
      [], // 0 orders, 0 reviews
      [],
    );

    const service = new ShopTierEvaluationService(pool);
    const result = await service.evaluateShop(pool, 'shop-override-1', criteria);

    assert.ok(result);
    assert.equal(result.status, 'SKIPPED_OVERRIDE');
    assert.equal(result.newTier, 'PREFERRED');
    assert.equal(shops[0].tier, 'PREFERRED'); // Not demoted despite 0 orders
    assert.match(result.reason, /tier_override enabled/i);
  });

  it('TEST-C3: Promotes STANDARD shop to PREFERRED when >= 20 orders, >= 4.5 rating, >= 5 visible reviews', async () => {
    const mockOrders: MockOrderRow[] = Array.from({ length: 25 }, (_, i) => ({
      order_id: `ord-${i}`,
      shop_id: 'shop-standard-1',
      status: 'COMPLETED',
    }));

    const mockReviews: MockReviewRow[] = Array.from({ length: 10 }, (_, i) => ({
      review_id: `rev-${i}`,
      product_id: 'prod-1',
      rating: 5,
      status: 'VISIBLE',
    }));

    const { pool, shops } = createMockDb(
      [
        {
          shop_id: 'shop-standard-1',
          shop_name: 'High Quality Store',
          tier: 'STANDARD',
          tier_override: false,
          tier_override_reason: null,
          status: 'ACTIVE',
        },
      ],
      mockOrders,
      mockReviews,
    );

    const service = new ShopTierEvaluationService(pool);
    const result = await service.evaluateShop(pool, 'shop-standard-1', criteria);

    assert.ok(result);
    assert.equal(result.status, 'PROMOTED');
    assert.equal(result.currentTier, 'STANDARD');
    assert.equal(result.newTier, 'PREFERRED');
    assert.equal(shops[0].tier, 'PREFERRED');
    assert.equal(result.stats.completedOrders, 25);
    assert.equal(result.stats.averageRating, 5);
  });

  it('TEST-C4: Demotes PREFERRED shop to STANDARD when completed orders or rating drop below threshold', async () => {
    const mockOrders: MockOrderRow[] = Array.from({ length: 5 }, (_, i) => ({
      order_id: `ord-${i}`,
      shop_id: 'shop-preferred-1',
      status: 'COMPLETED',
    })); // Only 5 orders (< 20)

    const mockReviews: MockReviewRow[] = Array.from({ length: 2 }, (_, i) => ({
      review_id: `rev-${i}`,
      product_id: 'prod-1',
      rating: 3,
      status: 'VISIBLE',
    }));

    const { pool, shops } = createMockDb(
      [
        {
          shop_id: 'shop-preferred-1',
          shop_name: 'Underperforming Store',
          tier: 'PREFERRED',
          tier_override: false,
          tier_override_reason: null,
          status: 'ACTIVE',
        },
      ],
      mockOrders,
      mockReviews,
    );

    const service = new ShopTierEvaluationService(pool);
    const result = await service.evaluateShop(pool, 'shop-preferred-1', criteria);

    assert.ok(result);
    assert.equal(result.status, 'DEMOTED');
    assert.equal(result.currentTier, 'PREFERRED');
    assert.equal(result.newTier, 'STANDARD');
    assert.equal(shops[0].tier, 'STANDARD');
  });

  it('TEST-C5: Only counts reviews with status = VISIBLE, ignoring HIDDEN reviews', async () => {
    const mockOrders: MockOrderRow[] = Array.from({ length: 25 }, (_, i) => ({
      order_id: `ord-${i}`,
      shop_id: 'shop-reviews-1',
      status: 'COMPLETED',
    }));

    // 10 reviews total, but 8 are HIDDEN (spam/toxic), only 2 are VISIBLE (< 5 minVisibleReviews)
    const mockReviews: MockReviewRow[] = [
      { review_id: 'rev-1', product_id: 'p1', rating: 5, status: 'VISIBLE' },
      { review_id: 'rev-2', product_id: 'p1', rating: 5, status: 'VISIBLE' },
      ...Array.from({ length: 8 }, (_, i) => ({
        review_id: `rev-hidden-${i}`,
        product_id: 'p1',
        rating: 5,
        status: 'HIDDEN' as const,
      })),
    ];

    const { pool, shops } = createMockDb(
      [
        {
          shop_id: 'shop-reviews-1',
          shop_name: 'Spam Reviewed Store',
          tier: 'STANDARD',
          tier_override: false,
          tier_override_reason: null,
          status: 'ACTIVE',
        },
      ],
      mockOrders,
      mockReviews,
    );

    const service = new ShopTierEvaluationService(pool);
    const result = await service.evaluateShop(pool, 'shop-reviews-1', criteria);

    assert.ok(result);
    assert.equal(result.status, 'UNCHANGED'); // 2 visible reviews < 5 minVisibleReviews
    assert.equal(result.newTier, 'STANDARD');
    assert.equal(shops[0].tier, 'STANDARD');
    assert.equal(result.stats.visibleReviewsCount, 2);
  });

  it('TEST-C6: Evaluates all active shops in batch and returns aggregated summary', async () => {
    const { pool } = createMockDb(
      [
        { shop_id: 's1', shop_name: 'Mall 1', tier: 'MALL', tier_override: false, tier_override_reason: null, status: 'ACTIVE' },
        { shop_id: 's2', shop_name: 'Override 1', tier: 'STANDARD', tier_override: true, tier_override_reason: 'Pinned', status: 'ACTIVE' },
        { shop_id: 's3', shop_name: 'Inactive 1', tier: 'STANDARD', tier_override: false, tier_override_reason: null, status: 'INACTIVE' },
      ],
      [],
      [],
    );

    const service = new ShopTierEvaluationService(pool);
    const summary = await service.evaluateAllActiveShops(criteria);

    assert.equal(summary.totalEvaluated, 2); // s3 is INACTIVE, so only s1 and s2 evaluated
    assert.equal(summary.skippedCount, 2);
    assert.equal(summary.promotedCount, 0);
    assert.equal(summary.demotedCount, 0);
  });
});

describe('Đợt C: Catalog Search Boost MALL & Strict Sort Priority', () => {
  it('TEST-C7 & TEST-C8: Generates correct ORDER BY clauses for default boost vs price sorts', async () => {
    let capturedSql = '';
    const mockPool = {
      async query(sql: string) {
        capturedSql = sql;
        if (sql.includes('SELECT COUNT(*)')) {
          return { rows: [{ count: '1' }] };
        }
        return {
          rows: [
            {
              product_id: 'p1',
              shop_id: 's1',
              category_id: 'c1',
              product_name: 'Test Product',
              description: 'Desc',
              created_at: new Date().toISOString(),
              shop_tier: 'MALL',
              min_price: '100000.00',
              max_price: '100000.00',
              total_stock: 10,
              image_url: null,
            },
          ],
        };
      },
    } as unknown as Pool;

    const repo = new PgProductRepository(mockPool);

    // 1. Chế độ mặc định (!sortBy): Boost MALL (2) -> PREFERRED (1) -> STANDARD (0)
    await repo.queryPublic({});
    assert.match(
      capturedSql,
      /\(CASE WHEN s\.tier = 'MALL' THEN 2 WHEN s\.tier = 'PREFERRED' THEN 1 ELSE 0 END\) DESC/,
      'Default catalog query must boost MALL and PREFERRED',
    );

    // 2. Chế độ sắp xếp giá tăng dần (price_asc): Ưu tiên giá rẻ nhất, KHÔNG boost Mall
    await repo.queryPublic({ sortBy: 'price_asc' });
    assert.match(
      capturedSql,
      /ORDER BY min_price ASC, p\.product_id ASC/,
      'price_asc must strictly sort by price without Mall boost interference',
    );
    assert.doesNotMatch(
      capturedSql,
      /WHEN s\.tier = 'MALL' THEN 2/,
      'price_asc must NOT contain shop tier boost',
    );

    // 3. Chế độ sắp xếp giá giảm dần (price_desc): Ưu tiên giá cao nhất, KHÔNG boost Mall
    await repo.queryPublic({ sortBy: 'price_desc' });
    assert.match(
      capturedSql,
      /ORDER BY max_price DESC, p\.product_id ASC/,
      'price_desc must strictly sort by price without Mall boost interference',
    );
  });
});
