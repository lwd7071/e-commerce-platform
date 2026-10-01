CREATE TABLE admin_notification_campaigns (
  campaign_id UUID CONSTRAINT pk_admin_notification_campaigns PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  audience_role VARCHAR(20) NOT NULL CHECK (audience_role IN ('BUYER','SELLER')),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  payload_fingerprint CHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','COMPLETED')),
  recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  delivered_count INTEGER NOT NULL DEFAULT 0 CHECK (delivered_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_admin_notification_campaigns__admin_key UNIQUE (admin_id,idempotency_key)
);

CREATE TABLE admin_notification_campaign_recipients (
  campaign_id UUID NOT NULL REFERENCES admin_notification_campaigns(campaign_id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT')),
  sent_at TIMESTAMPTZ,
  PRIMARY KEY (campaign_id,user_id),
  CHECK ((status='SENT') = (sent_at IS NOT NULL))
);

CREATE INDEX idx_admin_notification_campaign_recipients_pending
  ON admin_notification_campaign_recipients(campaign_id,user_id) WHERE status='PENDING';

ALTER TABLE admin_notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_campaign_recipients ENABLE ROW LEVEL SECURITY;
