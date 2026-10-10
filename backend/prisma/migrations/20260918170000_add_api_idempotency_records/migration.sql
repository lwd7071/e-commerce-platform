CREATE TABLE api_idempotency_records (
  user_id UUID NOT NULL,
  endpoint VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  fingerprint CHAR(64) NOT NULL,
  result JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_api_idempotency_records PRIMARY KEY (user_id, endpoint, idempotency_key),
  CONSTRAINT fk_api_idempotency_records__user_id FOREIGN KEY (user_id)
    REFERENCES app_users(user_id) ON DELETE RESTRICT,
  CONSTRAINT ck_api_idempotency_records__key_length
    CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  CONSTRAINT ck_api_idempotency_records__fingerprint
    CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_api_idempotency_records__expiry
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_api_idempotency_records__expires_at
  ON api_idempotency_records(expires_at);
