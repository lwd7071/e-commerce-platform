import type { Pool } from 'pg';
import type { ISellerKpiRepository, SellerKpi } from '../domain/seller-kpi.ts';

export class PgSellerKpiRepository implements ISellerKpiRepository {
  constructor(private readonly pool: Pool) {}

  async getForShop(shopId: string): Promise<SellerKpi | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT s.shop_id, s.shop_name,
        COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE o.shop_id=s.shop_id AND o.status='COMPLETED'), 0)::text AS total_revenue,
        (SELECT COUNT(*) FROM orders o WHERE o.shop_id=s.shop_id AND o.status='COMPLETED')::int AS completed_orders_count,
        (SELECT COUNT(*) FROM orders o WHERE o.shop_id=s.shop_id AND o.status IN ('PENDING_CONFIRMATION','CONFIRMED','PREPARING'))::int AS pending_orders_count,
        (SELECT COUNT(*) FROM products p WHERE p.shop_id=s.shop_id AND p.status='ACTIVE')::int AS active_products_count,
        COALESCE((SELECT AVG(r.rating) FROM reviews r JOIN products p ON p.product_id=r.product_id WHERE p.shop_id=s.shop_id), 0)::float8 AS average_rating
       FROM shops s WHERE s.shop_id=$1`,
      [shopId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      shopId: String(row.shop_id), shopName: String(row.shop_name), totalRevenue: String(row.total_revenue),
      completedOrdersCount: Number(row.completed_orders_count), pendingOrdersCount: Number(row.pending_orders_count),
      activeProductsCount: Number(row.active_products_count), averageRating: Number(row.average_rating),
    };
  }
}
