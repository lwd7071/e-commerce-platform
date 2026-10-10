-- Forward-only: approved DinoPoint redemption and confirmed refund adjustments.
ALTER TABLE app_users DROP CONSTRAINT ck_app_users__loyalty_nonnegative;
ALTER TABLE app_users ADD CONSTRAINT ck_app_users__loyalty_nonnegative CHECK (total_spent >= 0);
ALTER TABLE vouchers ADD COLUMN loyalty_owner_id UUID NULL REFERENCES app_users(user_id) ON DELETE RESTRICT;
CREATE INDEX idx_vouchers__loyalty_owner ON vouchers(loyalty_owner_id) WHERE loyalty_owner_id IS NOT NULL;
ALTER TABLE loyalty_point_transactions
  ADD COLUMN operation_key TEXT NULL,
  ADD COLUMN voucher_id UUID NULL REFERENCES vouchers(voucher_id) ON DELETE RESTRICT,
  ADD COLUMN eligible_spent_amount NUMERIC(15,2) NULL CHECK (eligible_spent_amount >= 0),
  ADD COLUMN refunded_eligible_amount NUMERIC(15,2) NULL CHECK (refunded_eligible_amount > 0);
CREATE UNIQUE INDEX uq_loyalty_transactions__operation_key
  ON loyalty_point_transactions(operation_key) WHERE operation_key IS NOT NULL;
CREATE UNIQUE INDEX uq_loyalty_transactions__voucher
  ON loyalty_point_transactions(voucher_id) WHERE voucher_id IS NOT NULL;
