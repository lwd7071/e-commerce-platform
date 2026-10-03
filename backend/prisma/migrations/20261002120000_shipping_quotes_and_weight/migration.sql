-- CR-SHIPPING-01: preserve legacy address/order snapshots while adding 2026
-- province/ward identity for future buyer addresses and seller pickup points.
ALTER TABLE products
  ADD COLUMN weight_grams INTEGER NOT NULL DEFAULT 200,
  ADD CONSTRAINT ck_products__weight_grams_positive CHECK (weight_grams > 0);

ALTER TABLE addresses
  ALTER COLUMN district DROP NOT NULL,
  ADD COLUMN province_code VARCHAR(10),
  ADD COLUMN ward_code VARCHAR(10),
  ADD CONSTRAINT ck_addresses__administrative_codes_paired CHECK ((province_code IS NULL) = (ward_code IS NULL));

ALTER TABLE orders ALTER COLUMN district DROP NOT NULL;

ALTER TABLE shops
  ADD COLUMN pickup_province_code VARCHAR(10),
  ADD COLUMN pickup_province VARCHAR(100),
  ADD COLUMN pickup_ward_code VARCHAR(10),
  ADD COLUMN pickup_ward VARCHAR(100),
  ADD COLUMN pickup_detail_address VARCHAR(255),
  ADD CONSTRAINT ck_shops__pickup_administrative_codes_paired CHECK ((pickup_province_code IS NULL) = (pickup_ward_code IS NULL));

-- This catalog is deployed as versioned local data by the shipping module;
-- code columns intentionally remain strings because Government administrative
-- codes are identifiers and must preserve leading zeroes.
