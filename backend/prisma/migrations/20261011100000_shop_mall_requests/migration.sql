-- Migration: 20261011100000_shop_mall_requests
-- Mục đích: Quản lý yêu cầu xét duyệt nâng hạng Dino Mall của Seller

CREATE TABLE shop_mall_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  admin_id UUID REFERENCES app_users(user_id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  document_url VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  reviewed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_mall_req_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),

  CONSTRAINT chk_mall_req_reason_len CHECK (
    char_length(btrim(reason)) >= 10 AND char_length(reason) <= 1000
  ),

  CONSTRAINT chk_mall_req_doc_url CHECK (
    char_length(btrim(document_url)) >= 10
    AND char_length(document_url) <= 500
    AND document_url ~* '^https?://'
    AND document_url !~* '^(javascript|data|file|blob):'
  ),

  CONSTRAINT chk_mall_req_state_fields CHECK (
    (status = 'PENDING' AND admin_id IS NULL AND admin_note IS NULL AND reviewed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND admin_id IS NULL AND admin_note IS NULL AND reviewed_at IS NULL)
    OR (status = 'APPROVED' AND admin_id IS NOT NULL AND reviewed_at IS NOT NULL AND cancelled_at IS NULL AND admin_note IS NOT NULL AND char_length(btrim(admin_note)) >= 5)
    OR (status = 'REJECTED' AND admin_id IS NOT NULL AND reviewed_at IS NOT NULL AND cancelled_at IS NULL AND admin_note IS NOT NULL AND char_length(btrim(admin_note)) >= 5)
  )
);

CREATE INDEX idx_shop_mall_requests_shop_created ON shop_mall_requests(shop_id, created_at DESC);
CREATE INDEX idx_shop_mall_requests_status_created ON shop_mall_requests(status, created_at DESC);

CREATE UNIQUE INDEX uq_shop_mall_requests_pending_per_shop
  ON shop_mall_requests(shop_id)
  WHERE status = 'PENDING';

ALTER TABLE shop_mall_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shop_mall_requests FROM PUBLIC, anon, authenticated;
