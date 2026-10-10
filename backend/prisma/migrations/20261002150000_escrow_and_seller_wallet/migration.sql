CREATE TABLE shop_wallets (
  wallet_id UUID CONSTRAINT pk_shop_wallets PRIMARY KEY,
  shop_id UUID NOT NULL CONSTRAINT fk_shop_wallets__shop_id REFERENCES shops(shop_id) ON DELETE RESTRICT,
  balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  hold_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  bank_name VARCHAR(100),
  bank_account_number VARCHAR(50),
  bank_account_holder VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_shop_wallets__balance_nonnegative CHECK (balance >= 0),
  CONSTRAINT ck_shop_wallets__hold_balance_nonnegative CHECK (hold_balance >= 0),
  CONSTRAINT uq_shop_wallets__shop_id UNIQUE (shop_id)
);

CREATE TABLE escrow_records (
  escrow_id UUID CONSTRAINT pk_escrow_records PRIMARY KEY,
  order_id UUID NOT NULL CONSTRAINT fk_escrow_records__order_id REFERENCES orders(order_id) ON DELETE RESTRICT,
  shop_id UUID NOT NULL CONSTRAINT fk_escrow_records__shop_id REFERENCES shops(shop_id) ON DELETE RESTRICT,
  gross_amount NUMERIC(15,2) NOT NULL,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  commission_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'HOLDING',
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_escrow_records__status CHECK (status IN ('HOLDING','RELEASED','REFUNDED')),
  CONSTRAINT ck_escrow_records__formula CHECK (gross_amount = commission_fee + net_amount),
  CONSTRAINT uq_escrow_records__order_id UNIQUE (order_id)
);

CREATE TABLE wallet_transactions (
  transaction_id UUID CONSTRAINT pk_wallet_transactions PRIMARY KEY,
  wallet_id UUID NOT NULL CONSTRAINT fk_wallet_transactions__wallet_id REFERENCES shop_wallets(wallet_id) ON DELETE RESTRICT,
  type VARCHAR(30) NOT NULL,
  amount NUMERIC(15,2) NOT NULL,
  balance_before NUMERIC(15,2) NOT NULL,
  balance_after NUMERIC(15,2) NOT NULL,
  reference_type VARCHAR(30) NOT NULL,
  reference_id UUID NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_wallet_transactions__type CHECK (type IN ('SETTLEMENT','WITHDRAWAL_HOLD','WITHDRAWAL_SUCCESS','WITHDRAWAL_REJECTED'))
);

CREATE TABLE withdrawal_requests (
  request_id UUID CONSTRAINT pk_withdrawal_requests PRIMARY KEY,
  shop_id UUID NOT NULL CONSTRAINT fk_withdrawal_requests__shop_id REFERENCES shops(shop_id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL,
  bank_name VARCHAR(100) NOT NULL,
  bank_account_number VARCHAR(50) NOT NULL,
  bank_account_holder VARCHAR(150) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  processed_by UUID CONSTRAINT fk_withdrawal_requests__processed_by REFERENCES app_users(user_id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_withdrawal_requests__amount_positive CHECK (amount > 0),
  CONSTRAINT ck_withdrawal_requests__status CHECK (status IN ('PENDING','APPROVED','REJECTED'))
);

CREATE INDEX idx_escrow_records__shop_id ON escrow_records(shop_id);
CREATE INDEX idx_escrow_records__status ON escrow_records(status);
CREATE INDEX idx_wallet_transactions__wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_withdrawal_requests__shop_id ON withdrawal_requests(shop_id);
CREATE INDEX idx_withdrawal_requests__status ON withdrawal_requests(status);

ALTER TABLE shop_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE shop_wallets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE escrow_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE wallet_transactions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE withdrawal_requests FROM PUBLIC, anon, authenticated;
