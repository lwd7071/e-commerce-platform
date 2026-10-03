-- Migration: 20260922120000_t2_performance_indexes
-- Owner: Người 2 (Database & Supabase)
-- Inputs: Bàn giao từ Người 4 (buyer-query-patterns.md) và Người 3 (Catalog pg-catalog.repository.ts)

-- 1. Buyer domain: Cart items retrieval & display order (Pattern C-02)
CREATE INDEX IF NOT EXISTS idx_cart_items__cart_id__created_at
  ON cart_items(cart_id, created_at ASC);

-- 2. Buyer domain: Active vouchers listing (Pattern V-01 Partial Index)
CREATE INDEX IF NOT EXISTS idx_vouchers__active_listing
  ON vouchers(scope, shop_id, end_at, created_at DESC)
  WHERE status = 'ACTIVE' AND quantity > 0;

-- 3. Buyer domain: Visible reviews for PDP (Pattern R-01 Partial Index)
CREATE INDEX IF NOT EXISTS idx_reviews__product_visible
  ON reviews(product_id, created_at DESC)
  WHERE status = 'VISIBLE';

-- 4. Buyer domain: User addresses listing with default first (Pattern U-01)
CREATE INDEX IF NOT EXISTS idx_addresses__user_id__default
  ON addresses(user_id, is_default DESC, created_at DESC);

-- 5. Catalog domain: Products by shop and status
CREATE INDEX IF NOT EXISTS idx_products__shop_id__status
  ON products(shop_id, status);

-- 6. Catalog domain: Products by category and status
CREATE INDEX IF NOT EXISTS idx_products__category_id__status
  ON products(category_id, status);

-- 7. Catalog domain: Product variants by product and status
CREATE INDEX IF NOT EXISTS idx_product_variants__product_id__status
  ON product_variants(product_id, status);
