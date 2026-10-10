-- Migration: 20261003110000_buyer_loyalty
-- Add buyer_tier, total_spent, loyalty_points to app_users
-- Create loyalty_point_transactions ledger table

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS buyer_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS total_spent NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS loyalty_points INT NOT NULL DEFAULT 0;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS ck_app_users__buyer_tier,
  ADD CONSTRAINT ck_app_users__buyer_tier CHECK (buyer_tier IN ('STANDARD', 'VIP'));

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS ck_app_users__loyalty_nonnegative,
  ADD CONSTRAINT ck_app_users__loyalty_nonnegative CHECK (total_spent >= 0 AND loyalty_points >= 0);

CREATE TABLE IF NOT EXISTS loyalty_point_transactions (
  transaction_id UUID CONSTRAINT pk_loyalty_point_transactions PRIMARY KEY,
  user_id UUID NOT NULL,
  points_delta INT NOT NULL,
  reference_order_id UUID NULL,
  reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_loyalty_transactions__user_id FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_loyalty_transactions__order_id FOREIGN KEY (reference_order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions__user_created
  ON loyalty_point_transactions(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_transactions__order_earned
  ON loyalty_point_transactions(reference_order_id)
  WHERE reason = 'ORDER_COMPLETED';
