-- CreateTable
CREATE TABLE IF NOT EXISTS shop_chat_presence (
  shop_id UUID CONSTRAINT pk_shop_chat_presence PRIMARY KEY REFERENCES shops(shop_id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shop_chat_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shop_chat_presence FROM PUBLIC, anon, authenticated;
