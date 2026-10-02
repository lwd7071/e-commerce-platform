CREATE TABLE chat_conversations (
  conversation_id UUID CONSTRAINT pk_chat_conversations PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  shop_id UUID NOT NULL REFERENCES shops(shop_id) ON DELETE RESTRICT,
  current_product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
  mode VARCHAR(30) NOT NULL DEFAULT 'BOT_ASSISTANT' CHECK (mode IN ('BOT_ASSISTANT', 'LIVE_AGENT')),
  bot_permissions JSONB NOT NULL DEFAULT '{"allow_stock": true, "allow_price": true, "allow_variants": true, "allow_description": true}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_conversations__buyer_shop UNIQUE (buyer_id, shop_id)
);

CREATE TABLE chat_messages (
  message_id UUID CONSTRAINT pk_chat_messages PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE,
  client_message_id VARCHAR(100),
  sender_id UUID REFERENCES app_users(user_id) ON DELETE SET NULL,
  sender_role VARCHAR(20) NOT NULL CHECK (sender_role IN ('BUYER', 'SELLER', 'BOT')),
  message_type VARCHAR(30) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'PRODUCT_CARD', 'HANDOFF_REQUEST', 'SYSTEM')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_chat_messages__conversation_client_id UNIQUE (conversation_id, client_message_id)
);

CREATE INDEX idx_chat_conversations__buyer
  ON chat_conversations(buyer_id, last_message_at DESC);

CREATE INDEX idx_chat_conversations__shop
  ON chat_conversations(shop_id, last_message_at DESC);

CREATE INDEX idx_chat_messages__conversation
  ON chat_messages(conversation_id, created_at ASC);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE chat_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE chat_messages FROM PUBLIC, anon, authenticated;
