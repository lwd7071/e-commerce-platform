CREATE TABLE flash_sale_sessions (
  slot_id UUID CONSTRAINT pk_flash_sale_sessions PRIMARY KEY,
  slot_name VARCHAR(150) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING','ACTIVE','ENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_flash_sale_sessions__time_range CHECK (start_time < end_time)
);

CREATE TABLE flash_sale_items (
  item_id UUID CONSTRAINT pk_flash_sale_items PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES flash_sale_sessions(slot_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES product_variants(variant_id) ON DELETE RESTRICT,
  original_price NUMERIC(15,2) NOT NULL CHECK (original_price > 0),
  flash_sale_price NUMERIC(15,2) NOT NULL CHECK (flash_sale_price > 0 AND flash_sale_price <= original_price),
  allocated_stock INTEGER NOT NULL CHECK (allocated_stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_flash_sale_items__slot_variant UNIQUE (slot_id, variant_id)
);

CREATE TABLE flash_sale_compensation_logs (
  compensation_id UUID CONSTRAINT pk_flash_sale_compensation_logs PRIMARY KEY,
  slot_id UUID NOT NULL,
  item_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPLIED','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flash_sale_sessions__status_time ON flash_sale_sessions(status, start_time, end_time);
CREATE INDEX idx_flash_sale_items__slot_id ON flash_sale_items(slot_id);
CREATE INDEX idx_flash_sale_compensation_logs__slot_id ON flash_sale_compensation_logs(slot_id);

ALTER TABLE flash_sale_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE flash_sale_compensation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY flash_sale_sessions_public_read ON flash_sale_sessions FOR SELECT USING (true);
CREATE POLICY flash_sale_items_public_read ON flash_sale_items FOR SELECT USING (true);
