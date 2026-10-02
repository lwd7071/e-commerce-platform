-- Migration: 20261003100000_shop_tiering
-- Description: Add tier and tier override metadata columns to shops table

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS tier_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tier_override_reason TEXT NULL,
  ADD COLUMN IF NOT EXISTS tier_overridden_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS tier_override_by UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ck_shops__tier'
  ) THEN
    ALTER TABLE shops
      ADD CONSTRAINT ck_shops__tier CHECK (tier IN ('STANDARD', 'PREFERRED', 'MALL'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_shops__tier_override_by'
  ) THEN
    ALTER TABLE shops
      ADD CONSTRAINT fk_shops__tier_override_by FOREIGN KEY (tier_override_by) REFERENCES app_users(user_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shops__tier ON shops(tier);
